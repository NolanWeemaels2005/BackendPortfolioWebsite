import express from "express";
import multer from "multer";
import streamifier from "streamifier";
import cloudinary from "../config/cloudinary.js";
import authMiddleware from "../middleware/authMiddleware.js";
import Project from "../models/Project.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "clientLogoSvg") {
      if (file.mimetype !== "image/svg+xml") {
        return cb(new Error("clientLogoSvg moet een SVG bestand zijn."));
      }

      return cb(null, true);
    }

    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Alle uploads moeten afbeeldingen zijn."));
    }

    cb(null, true);
  }
});

const projectUpload = upload.fields([
  { name: "heroImage", maxCount: 1 },
  { name: "images", maxCount: 3 },
  { name: "clientLogoSvg", maxCount: 1 }
]);

const slugify = (value) =>
  value
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const createUniqueSlug = async (title) => {
  const baseSlug = slugify(title);

  if (!baseSlug) {
    throw new Error("Titel kan niet worden omgezet naar een geldige slug.");
  }

  let slug = baseSlug;
  let counter = 2;

  while (await Project.exists({ slug })) {
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }

  return slug;
};

const uploadBufferToCloudinary = (fileBuffer, folder) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        return resolve(result.secure_url);
      }
    );

    streamifier.createReadStream(fileBuffer).pipe(stream);
  });

router.get("/", async (req, res) => {
  try {
    const projects = await Project.find().sort({ createdAt: -1 });
    return res.json(projects);
  } catch (error) {
    return res.status(500).json({
      message: "Projecten ophalen mislukt.",
      error: error.message
    });
  }
});

router.get("/:slug", async (req, res) => {
  try {
    const project = await Project.findOne({ slug: req.params.slug });

    if (!project) {
      return res.status(404).json({ message: "Project niet gevonden." });
    }

    return res.json(project);
  } catch (error) {
    return res.status(500).json({
      message: "Project ophalen mislukt.",
      error: error.message
    });
  }
});

router.post("/", authMiddleware, projectUpload, async (req, res) => {
  try {
    const { title, text } = req.body;
    const heroFiles = req.files?.heroImage || [];
    const imageFiles = req.files?.images || [];
    const clientLogoSvgFiles = req.files?.clientLogoSvg || [];

    if (!title || !title.trim()) {
      return res.status(400).json({ message: "title is verplicht." });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ message: "text is verplicht." });
    }

    if (heroFiles.length !== 1) {
      return res.status(400).json({
        message: "heroImage is verplicht en moet exact 1 bestand zijn."
      });
    }

    if (imageFiles.length !== 3) {
      return res.status(400).json({
        message: "images is verplicht en moet exact 3 bestanden bevatten."
      });
    }

    if (clientLogoSvgFiles.length > 1) {
      return res.status(400).json({
        message: "clientLogoSvg mag maximaal 1 SVG bestand bevatten."
      });
    }

    const slug = await createUniqueSlug(title);

    const heroImage = await uploadBufferToCloudinary(
      heroFiles[0].buffer,
      "portfolio/hero"
    );

    const images = await Promise.all(
      imageFiles.map((file) =>
        uploadBufferToCloudinary(file.buffer, "portfolio/projects")
      )
    );

    const clientLogoSvg =
      clientLogoSvgFiles.length === 1
        ? await uploadBufferToCloudinary(
            clientLogoSvgFiles[0].buffer,
            "portfolio/client-logos"
          )
        : null;

    const project = await Project.create({
      title: title.trim(),
      slug,
      text: text.trim(),
      heroImage,
      clientLogoSvg,
      images
    });

    return res.status(201).json({
      message: "Project aangemaakt.",
      project
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Er bestaat al een project met deze slug."
      });
    }

    return res.status(500).json({
      message: "Project aanmaken mislukt.",
      error: error.message
    });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);

    if (!project) {
      return res.status(404).json({ message: "Project niet gevonden." });
    }

    return res.json({
      message: "Project verwijderd.",
      projectId: project._id
    });
  } catch (error) {
    return res.status(500).json({
      message: "Project verwijderen mislukt.",
      error: error.message
    });
  }
});

export default router;
