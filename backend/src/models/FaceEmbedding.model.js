import mongoose, { Schema } from "mongoose";

/**
 * Stores the 512-d ArcFace embedding generated at enrollment time.
 * Keyed per (person, organization) rather than per person alone — a person
 * enrolled in multiple orgs can have a separate embedding row per org
 * (typically copied from an existing one on join, rather than re-captured).
 * Kept as its own collection rather than embedded on Person so large float
 * arrays don't bloat every Person document read.
 */
const faceEmbeddingSchema = new Schema(
  {
    person: {
      type: Schema.Types.ObjectId,
      ref: "Person",
      required: true,
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

// One embedding per person per organization (re-enrolling overwrites it).
faceEmbeddingSchema.index({ person: 1, organization: 1 }, { unique: true });

export const FaceEmbedding = mongoose.model("FaceEmbedding", faceEmbeddingSchema);