/**
 * Creates a flagged-match entry with an image preview for one member.  ->  backend/src/scripts/seedFlag.js
 * Run from the backend folder:   node src/scripts/seedFlag.js
 *
 * .env:
 *   SEED_ORG_CODE=IEC090
 *   SEED_FLAG_EMAIL=member@example.com      # member to flag
 *   SEED_FLAG_IMAGE=./flag.jpg              # local file path OR a public https image URL
 *   SEED_FLAG_SCORE=0.46                    # optional, between 0.40 and 0.50
 *   CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET   (already used by the app)
 */
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { v2 as cloudinary } from "cloudinary";

const here = path.dirname(fileURLToPath(import.meta.url));
try {
  const dotenv = await import("dotenv");
  (dotenv.default ?? dotenv).config({ path: path.resolve(here, "../../.env") });
} catch { /* rely on shell env */ }

const loadModel = async (file, name) => {
  const m = await import(pathToFileURL(path.join(here, "../models", file)).href);
  return m.default ?? m[name];
};
const env = (k, d) => (process.env[k] ? process.env[k] : d);

try {
  for (const k of ["SEED_ORG_CODE", "SEED_FLAG_EMAIL", "SEED_FLAG_IMAGE"]) if (!env(k)) throw new Error(`Missing in .env: ${k}`);
  const uri = env("MONGODB_URI") || env("MONGO_URI") || env("DATABASE_URL");
  if (!uri) throw new Error("Missing in .env: MONGODB_URI (or MONGO_URI / DATABASE_URL)");

  const Person = await loadModel("Person.model.js", "Person");
  const Membership = await loadModel("Membership.model.js", "Membership");
  const Organization = await loadModel("Organization.model.js", "Organization");
  const AttendanceRecord = await loadModel("AttendanceRecord.model.js", "AttendanceRecord");

  await mongoose.connect(uri);
  const org = await Organization.findOne({ code: env("SEED_ORG_CODE").toUpperCase() });
  if (!org) throw new Error("Organization not found.");
  const person = await Person.findOne({ email: env("SEED_FLAG_EMAIL").toLowerCase() });
  if (!person) throw new Error("Member not found.");
  const mem = await Membership.findOne({ person: person._id, organization: org._id, status: "active" });
  if (!mem) throw new Error("Member has no active membership in this organization.");

  // upload the image (local file or URL) to Cloudinary, same area the app uses for flagged captures
  cloudinary.config({
    cloud_name: env("CLOUDINARY_CLOUD_NAME"), api_key: env("CLOUDINARY_API_KEY"), api_secret: env("CLOUDINARY_API_SECRET"),
  });
  const src = env("SEED_FLAG_IMAGE");
  const up = await cloudinary.uploader.upload(/^https?:/.test(src) ? src : path.resolve(process.cwd(), src), {
    folder: env("SEED_FLAG_FOLDER", "facecheck-in/flagged"), resource_type: "image",
  });

  const score = Math.min(0.5, Math.max(0.4, parseFloat(env("SEED_FLAG_SCORE", "0.46"))));
  await Membership.updateOne({ _id: mem._id }, { $set: {
    isFlagged: true, flagReason: `Low-confidence match (score ${score.toFixed(2)})`, flaggedAt: new Date(),
    flaggedImageUrl: up.secure_url, flaggedImagePublicId: up.public_id,
  } });

  // also mark the member's latest attendance record as the flagged one
  const rec = await AttendanceRecord.findOne({ person: person._id, organization: org._id }).sort({ markedAt: -1 });
  if (rec) await AttendanceRecord.updateOne({ _id: rec._id }, { $set: { isFlagged: true, matchScore: score } });

  console.log(`Flagged ${person.name}. Image: ${up.secure_url}`);
  console.log(rec ? `Latest attendance record (${rec.markedAt.toDateString()}) marked flagged.` : "No attendance record found to mark.");
} catch (err) {
  console.error("Failed:", err.message || err);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}