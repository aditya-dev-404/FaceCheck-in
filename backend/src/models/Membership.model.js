import mongoose, { Schema } from "mongoose";

// Membership = a Person's relationship to one Organization.
// Everything that used to be "per-org" on the old User document lives here.
// FaceEmbedding stays keyed per (person, organization) — see note in
// FaceEmbedding.model.js — but the embedding vector itself can be copied
// from an existing Membership's embedding when a Person joins a new org,
// instead of re-capturing.
const membershipSchema = new Schema(
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
    role: {
      type: String,
      enum: ["admin", "member"],
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    checkInTime: {
      type: String, // "HH:mm" 24-hr format, e.g. "09:00" — null means no check-in time assigned
      default: null,
    },
    gracePeriodMinutes: {
      type: Number,
      default: 10,
    },
    // "active": full member, counts for attendance/dashboards/kiosk matching.
    // "pending": created via invite (addMember found an existing Person) —
    // doesn't count anywhere until the person logs in and accepts it.
    status: {
      type: String,
      enum: ["active", "pending"],
      default: "active",
    },
    isEnrolled: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isFlagged: {
      type: Boolean,
      default: false,
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
      default: null,
    },
    flaggedImagePublicId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// A person can only have one membership per organization.
membershipSchema.index({ person: 1, organization: 1 }, { unique: true });

export const Membership = mongoose.model("Membership", membershipSchema);