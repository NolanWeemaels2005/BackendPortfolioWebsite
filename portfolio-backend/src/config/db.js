import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI ontbreekt in de environment variables.");
  }

  try {
    const connection = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000
    });
    console.log(`MongoDB verbonden: ${connection.connection.host}`);
    return connection;
  } catch (error) {
    console.error("MongoDB connectie mislukt:", error.message);
    console.error(
      "Controleer je MONGO_URI, database user/password en MongoDB Atlas Network Access allowlist."
    );
    return null;
  }
};

export default connectDB;
