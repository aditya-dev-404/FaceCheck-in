/**
 * Central place to read and validate required environment variables.
 * Import `env` anywhere instead of reading process.env directly, so a
 * missing var fails loudly at startup rather than deep inside a request.
 */
import dotenv from "dotenv";

dotenv.config();

const required = [
  "PORT",
  "MONGO_URI",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "ML_SERVICE_URL",
  "BREVO_API_KEY",
  "SENDER_MAIL",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "GEMINI_API_KEY",
  "GEMINI_MODEL"
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  PORT: process.env.PORT,
  MONGO_URI: process.env.MONGO_URI,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  ML_SERVICE_URL: process.env.ML_SERVICE_URL,
  BREVO_API_KEY: process.env.BREVO_API_KEY,
  SENDER_MAIL: process.env.SENDER_MAIL,
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:5173",
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
};