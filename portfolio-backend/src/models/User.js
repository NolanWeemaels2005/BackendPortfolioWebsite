import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is verplicht."],
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: [true, "Wachtwoord is verplicht."]
    }
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;
