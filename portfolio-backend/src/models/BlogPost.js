import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema({
  url: { type: String, required: true },
  publicId: { type: String, required: true },
  type: { type: String, enum: ["image", "video"], required: true },
  role: { type: String, enum: ["before", "after", "process", "failed", "reference"], default: "process" },
  caption: { type: String, default: "", trim: true },
  credit: { type: String, default: "", trim: true }
});
const schema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true },
  summary: { type: String, default: "", trim: true },
  context: { type: String, default: "", trim: true },
  process: { type: String, default: "", trim: true },
  learning: { type: String, default: "", trim: true },
  reflection: { type: String, default: "", trim: true },
  aiUsed: { type: Boolean, default: false },
  aiContribution: { type: String, default: "", trim: true },
  humanContribution: { type: String, default: "", trim: true },
  planning: { type: String, default: "", trim: true },
  sources: { type: String, default: "", trim: true },
  status: { type: String, enum: ["draft", "published"], default: "draft" },
  publishedAt: { type: Date, default: null },
  media: [mediaSchema]
}, { timestamps: true });
export default mongoose.model("BlogPost", schema);
