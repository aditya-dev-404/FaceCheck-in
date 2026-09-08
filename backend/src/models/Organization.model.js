import mongoose, { Schema } from "mongoose";

/**
 * Top-level tenant. Every User, FaceEmbedding, and AttendanceRecord is
 * scoped to an Organization so multiple institutions/companies can use
 * the same deployment without seeing each other's data.
 */
const organizationSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true, // short join code, e.g. "IEC2026"
    },
    categories: {
      type: [String],
      default: [], // e.g. ["Student", "Teacher", "Staff"] — defined per-org, since these differ by org type
    },
    kioskSecretHash: {
      type: String,
      default: null, // bcrypt hash of the kiosk's secret — the raw secret is shown to the admin once and never stored
    },
    logoUrl: {
      type: String,
      default: null,
    },
    logoPublicId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

export const Organization = mongoose.model("Organization", organizationSchema);