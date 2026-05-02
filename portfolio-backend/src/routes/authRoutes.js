import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();

const createToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET ontbreekt in de environment variables.");
  }

  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "7d"
  });
};

router.post("/seed-admin", async (req, res) => {
  try {
    const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      return res.status(500).json({
        message: "ADMIN_EMAIL en ADMIN_PASSWORD moeten in .env staan."
      });
    }

    const existingUsers = await User.countDocuments();

    if (existingUsers > 0) {
      return res.status(409).json({
        message: "Er bestaat al een gebruiker. Seed-admin is alleen voor eerste setup."
      });
    }

    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);

    const admin = await User.create({
      email: ADMIN_EMAIL,
      password: hashedPassword
    });

    return res.status(201).json({
      message: "Admin gebruiker aangemaakt.",
      user: {
        id: admin._id,
        email: admin.email
      }
    });
  } catch (error) {
    return res.status(500).json({
      message: "Admin seeden mislukt.",
      error: error.message
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email en wachtwoord zijn verplicht."
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return res.status(401).json({ message: "Ongeldige email of wachtwoord." });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      return res.status(401).json({ message: "Ongeldige email of wachtwoord." });
    }

    return res.json({
      message: "Login gelukt.",
      token: createToken(user._id),
      user: {
        id: user._id,
        email: user.email
      }
    });
  } catch (error) {
    return res.status(500).json({
      message: "Login mislukt.",
      error: error.message
    });
  }
});

export default router;
