import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Titel is verplicht."],
      trim: true
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    text: {
      type: String,
      required: [true, "Tekst is verplicht."],
      trim: true
    },
    heroImage: {
      type: String,
      required: [true, "Hero image URL is verplicht."]
    },
    clientLogoSvg: {
      type: String,
      default: null
    },
    images: {
      type: [String],
      required: true,
      validate: {
        validator: (value) => Array.isArray(value) && value.length === 3,
        message: "Een project moet exact 3 image URLs hebben."
      }
    }
  },
  { timestamps: true }
);

const Project = mongoose.model("Project", projectSchema);

export default Project;
