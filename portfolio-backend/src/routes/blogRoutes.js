import express from "express";
import multer from "multer";
import { tmpdir } from "node:os";
import { unlink } from "node:fs/promises";
import mongoose from "mongoose";
import cloudinary from "../config/cloudinary.js";
import auth from "../middleware/authMiddleware.js";
import BlogPost from "../models/BlogPost.js";
import { textFields, publicationErrors } from "../services/blogValidation.js";

const router = express.Router();
const wrap = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const upload = multer({
  dest: tmpdir(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /^(image\/(jpeg|png|webp|gif|avif)|video\/(mp4|webm|quicktime))$/;
    if (!allowed.test(file.mimetype)) {
      const error = new Error("Gebruik JPG, PNG, WebP, GIF, AVIF, MP4, WebM of MOV.");
      error.status = 400;
      return cb(error);
    }
    cb(null, true);
  }
}).single("file");
const roles = ["before", "after", "process", "failed", "reference"];
router.param("id", (req, res, next, id) => {
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Ongeldig bericht-ID." });
  next();
});
router.get("/", wrap(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const filter = { status: "published" };
  const [posts, total] = await Promise.all([
    BlogPost.find(filter).sort({ publishedAt: -1 }).skip((page - 1) * 12).limit(12).select("title slug summary publishedAt"),
    BlogPost.countDocuments(filter)
  ]);
  res.json({ posts, total, page, pages: Math.ceil(total / 12) });
}));
router.get("/admin", auth, wrap(async (req, res) => {
  res.json(await BlogPost.find().sort({ updatedAt: -1 }).select("title slug status updatedAt"));
}));
router.get("/admin/:id", auth, wrap(async (req, res) => {
  const post = await BlogPost.findById(req.params.id);
  if (!post) return res.status(404).json({ message: "Bericht niet gevonden." });
  res.json(post);
}));
router.post("/", auth, wrap(async (req, res) => {
  if (typeof req.body.title !== "string" || !req.body.title.trim()) return res.status(400).json({ message: "Titel is verplicht." });
  const id = new mongoose.Types.ObjectId();
  const base = req.body.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "blog";
  const post = await BlogPost.create({ _id: id, title: req.body.title, slug: `${base}-${id.toString().slice(-8)}` });
  res.status(201).json(post);
}));
router.put("/:id", auth, wrap(async (req, res) => {
  const post = await BlogPost.findById(req.params.id);
  if (!post) return res.status(404).json({ message: "Bericht niet gevonden." });
  for (const field of textFields) {
    if (req.body[field] !== undefined) {
      if (typeof req.body[field] !== "string") return res.status(400).json({ message: `${field} moet tekst zijn.` });
      post[field] = req.body[field];
    }
  }
  if (!post.title.trim()) return res.status(400).json({ message: "Titel is verplicht." });
  if (req.body.aiUsed !== undefined) {
    if (typeof req.body.aiUsed !== "boolean") return res.status(400).json({ message: "aiUsed moet een boolean zijn." });
    post.aiUsed = req.body.aiUsed;
  }
  if (req.body.status !== undefined) {
    if (!["draft", "published"].includes(req.body.status)) return res.status(400).json({ message: "Ongeldige status." });
    post.status = req.body.status;
  }
  if (post.status === "published") {
    const errors = publicationErrors(post);
    if (errors.length) return res.status(400).json({ message: errors.join(" "), errors });
    post.publishedAt ||= new Date();
  }
  await post.save();
  res.json(post);
}));
router.post("/:id/media", auth, wrap(async (req, res, next) => {
  const post = await BlogPost.findById(req.params.id);
  if (!post) return res.status(404).json({ message: "Bericht niet gevonden." });
  req.blogPost = post;
  next();
}), upload, wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Een bestand is verplicht." });
  let result;
  try {
    if (!roles.includes(req.body.role || "process")) return res.status(400).json({ message: "Ongeldige beeldrol." });
    const type = req.file.mimetype.startsWith("video/") ? "video" : "image";
    result = await cloudinary.uploader.upload(req.file.path, { folder: "portfolio/blog", resource_type: type });
    const media = { url: result.secure_url, publicId: result.public_id, type, role: req.body.role || "process", caption: req.body.caption || "", credit: req.body.credit || "" };
    // Atomic append keeps concurrent uploads from overwriting one another.
    const post = await BlogPost.findByIdAndUpdate(req.params.id, { $push: { media } }, { new: true, runValidators: true });
    if (!post) throw new Error("Bericht werd tijdens de upload verwijderd.");
    res.status(201).json(post);
  } catch (error) {
    if (result) await cloudinary.uploader.destroy(result.public_id, { resource_type: result.resource_type }).catch(() => {});
    throw error;
  } finally {
    await unlink(req.file.path).catch(() => {});
  }
}));
router.delete("/:id/media/:mediaId", auth, wrap(async (req, res) => {
  const post = await BlogPost.findById(req.params.id);
  const media = post?.media.id(req.params.mediaId);
  if (!media) return res.status(404).json({ message: "Media niet gevonden." });
  const remaining = post.media.filter(item => item.id !== media.id);
  if (post.status === "published" && publicationErrors({ ...post.toObject(), media: remaining }).length) {
    return res.status(400).json({ message: "Zet het bericht eerst op concept voordat je verplicht beeld verwijdert." });
  }
  await cloudinary.uploader.destroy(media.publicId, { resource_type: media.type });
  media.deleteOne();
  await post.save();
  res.json(post);
}));
router.delete("/:id", auth, wrap(async (req, res) => {
  const post = await BlogPost.findById(req.params.id);
  if (!post) return res.status(404).json({ message: "Bericht niet gevonden." });
  for (const item of post.media) await cloudinary.uploader.destroy(item.publicId, { resource_type: item.type });
  await post.deleteOne();
  res.json({ message: "Bericht verwijderd." });
}));
router.get("/:slug", wrap(async (req, res) => {
  const post = await BlogPost.findOne({ slug: req.params.slug, status: "published" });
  if (!post) return res.status(404).json({ message: "Bericht niet gevonden." });
  res.json(post);
}));
export default router;
