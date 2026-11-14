import mongoose, { Schema } from "mongoose";

// Membership = a Person's relationship to one Organization.
// Everything that used to be "per-org" on the old User document lives here.
//
// A person has AT MOST ONE "active" membership at any time (enforced by the
// partial unique index below). Earlier organizations stay on record as "past"
// memberships, so an organization can still see who used to belong to it and
// add them back later.
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
    // "active":  the person's current organization — counts for attendance/dashboards/kiosk matching.
    // "pending": an invite (admin added a person who already has an account) — counts nowhere until accepted.
    // "past":    the person was removed by an admin, left, or moved to another organization.
    status: {
      type: String,
      enum: ["active", "pending", "past"],
      default: "active",
    },
    leftAt: {
      type: Date,
      default: null,
    },
    // Why a membership became "past": removed by an admin, left on their own,
    // joined another organization, or an invite that an admin cancelled.
    leftReason: {
      type: String,
      enum: ["removed", "left", "switched", "invite_cancelled", null],
      default: null,
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

// One membership record per person per organization. Re-adding a past member
// reuses their existing record instead of creating a second one.
membershipSchema.index({ person: 1, organization: 1 }, { unique: true });

// ...and only one ACTIVE membership per person across all organizations.
membershipSchema.index({ person: 1 }, { unique: true, partialFilterExpression: { status: "active" } });

export const Membership = mongoose.model("Membership", membershipSchema);