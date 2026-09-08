import mongoose, { Schema } from "mongoose";

/**
 * Stores the 512-d ArcFace embedding generated at enrollment time.
 * One embedding per user (re-enrolling overwrites the old one). Kept as
 * its own collection rather than embedded on User so large float arrays
 * don't bloat every User document read.
 */
const faceEmbeddingSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    organization: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    embedding: {
      type: [Number], // length-512 L2-normalized vector from the ML service
      required: true,
    },
  },
  { timestamps: true }
);

export const FaceEmbedding = mongoose.model("FaceEmbedding", faceEmbeddingSchema);