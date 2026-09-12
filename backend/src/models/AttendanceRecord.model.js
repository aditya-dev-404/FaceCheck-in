import mongoose, { Schema } from "mongoose";

/**
 * One row per successful face-recognition attendance mark.
 * matchScore is the cosine similarity that cleared the tau=0.40 threshold,
 * kept for audit/debugging (e.g. spotting borderline matches later).
 */
const attendanceRecordSchema = new Schema(
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
    matchScore: {
      type: Number,
      required: true,
    },
    category: {
      type: String,
      default: null, // snapshot of the member's category at the time of marking, so it stays accurate even if their category is changed later
    },
    memberName: {
      type: String,
      default: null, // snapshot, so history/exports stay readable even if the member is later renamed or removed entirely
    },
    memberEmail: {
      type: String,
      default: null,
    },
    isFlagged: {
      type: Boolean,
      default: false, // this specific record's match score fell in the borderline zone
    },
    markedVia: {
      type: String,
      enum: ["kiosk", "admin"],
      default: "kiosk", // "kiosk" = the registered premises device; "admin" = manual fallback entry
    },
    markedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Prevents duplicate attendance rows for the same person on the same calendar day.
attendanceRecordSchema.index({ person: 1, markedAt: 1 });

export const AttendanceRecord = mongoose.model("AttendanceRecord", attendanceRecordSchema);