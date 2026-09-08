import mongoose, { Schema } from "mongoose";

/**
 * A person who can log in — either an admin (manages an organization,
 * enrolls people, views attendance) or a member (the person whose face
 * gets recognized for attendance).
 */
const userSchema = new Schema(
  {
    organization: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true, // stored as a bcrypt hash, never plaintext
    },
    role: {
      type: String,
      enum: ["admin", "member"],
      default: "member",
    },
    isEnrolled: {
      type: Boolean,
      default: false, // flips true once a FaceEmbedding exists for this user
    },
    category: {
      type: String,
      default: null, // must match one of the org's Organization.categories, validated in the controller
    },
    isActive: {
      type: Boolean,
      default: true, // deactivated members are blocked from logging in but their data (attendance history) is preserved
    },
    isFlagged: {
      type: Boolean,
      default: false, // set when a borderline-confidence attendance match suggests possible spoofing — needs admin review
    },
    flagReason: {
      type: String,
      default: null,
    },
    flaggedAt: {
      type: Date,
      default: null,
    },
    flaggedImageUrl: {
      type: String,
      default: null, // Cloudinary secure URL of the captured frame that triggered the flag
    },
    flaggedImagePublicId: {
      type: String,
      default: null, // needed to delete the image from Cloudinary later
    },
    avatarUrl: {
      type: String,
      default: null, // a display picture only — NEVER used for face recognition, which relies solely on FaceEmbedding
    },
    avatarPublicId: {
      type: String,
      default: null,
    },
    refreshToken: {
      type: String, // current valid refresh token, for rotate-on-refresh
      default: null,
    },
    resetPasswordToken: {
      type: String, // SHA-256 hash of the raw token emailed to the user — the raw token itself is never stored
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);