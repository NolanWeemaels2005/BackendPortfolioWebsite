import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import blogRoutes from "./routes/blogRoutes.js";
import { fileURLToPath } from "node:url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const isLocalDevelopmentOrigin = (origin) =>
  process.env.NODE_ENV !== "production" &&
  /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        isLocalDevelopmentOrigin(origin)
      ) {
        return callback(null, true);
      }

      return callback(new Error(`CORS origin niet toegestaan: ${origin}`));
    },
    credentials: true
  })
);

app.use(express.json());
app.use("/blog", express.static(fileURLToPath(new URL("../public", import.meta.url))));

app.get("/", (req, res) => {
  res.json({
    message: "Portfolio backend draait.",
    database:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

app.get("/api", (req, res) => {
  res.json({
    message: "Portfolio API draait.",
    database:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

app.get("/favicon.ico", (req, res) => {
  res.status(204).end();
});

const requireDatabase = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      message:
        "Database niet verbonden. Controleer MONGO_URI en MongoDB Atlas Network Access."
    });
  }

  next();
};

app.use("/api/auth", requireDatabase, authRoutes);
app.use("/api/projects", requireDatabase, projectRoutes);
app.use("/api/blog", requireDatabase, blogRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Route niet gevonden." });
});

app.use((error, req, res, next) => {
  if (error.status === 400 || error.name === "ValidationError") {
    return res.status(400).json({ message: error.message });
  }
  if (error.name === "MulterError") {
    return res.status(400).json({
      message: "Upload validatie mislukt.",
      error: error.message
    });
  }

  return res.status(500).json({
    message: "Er ging iets mis op de server.",
    error: error.message
  });
});

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server draait op poort ${PORT}`);
  });
};

startServer();
