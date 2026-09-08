import { AttendanceRecord } from "../models/AttendanceRecord.model.js";
import { User } from "../models/User.model.js";
import { ApiError } from "../utils/ApiError.js";
import { getEmbeddingsFromImage, findBestMatch } from "./faceMatch.service.js";
import { uploadFlaggedImage, deleteFlaggedImage } from "./cloudinary.service.js";

/**
 * Returns the [start, end) Date range for "today" in server-local time,
 * used to check whether a user has already been marked present today.
 */
const getTodayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

/**
 * Full recognition flow: image -> detect/embed (ML service) -> match
 * against enrolled faces -> dedupe against today's records -> write
 * AttendanceRecord.
 */
const markAttendance = async (imageBuffer, filename, mimetype, organizationId, markedVia = "kiosk") => {
  const faces = await getEmbeddingsFromImage(imageBuffer, filename, mimetype);

  if (faces.length > 1) {
    throw new ApiError(400, "Multiple faces detected — capture one person at a time");
  }

  const { matched, score, user, flagged } = await findBestMatch(faces[0].embedding, organizationId);

  if (!matched) {
    throw new ApiError(404, "Face not recognized. Please enroll first or try again");
  }

  const { start, end } = getTodayRange();
  const alreadyMarked = await AttendanceRecord.findOne({
    user: user._id,
    markedAt: { $gte: start, $lt: end },
  });

  if (alreadyMarked) {
    throw new ApiError(409, `Attendance already marked for ${user.name} today`);
  }

  const flagReason = flagged ? `Borderline face match confidence (score: ${score.toFixed(4)})` : null;

  const record = await AttendanceRecord.create({
    user: user._id,
    organization: organizationId,
    matchScore: score,
    category: user.category || null, // snapshot at time of marking
    memberName: user.name,
    memberEmail: user.email,
    isFlagged: flagged,
    markedVia,
  });

  if (flagged) {
    // Only one flagged-review image is kept per member — replace, don't
    // accumulate. If a previous flag's image exists, remove it first.
    const existingUser = await User.findById(user._id).select("flaggedImagePublicId");
    if (existingUser?.flaggedImagePublicId) {
      await deleteFlaggedImage(existingUser.flaggedImagePublicId).catch((err) =>
        console.error("Failed to delete previous flagged image:", err.message)
      );
    }

    let uploadResult = null;
    try {
      uploadResult = await uploadFlaggedImage(imageBuffer, user._id);
    } catch (err) {
      // Don't fail attendance marking just because the review image
      // couldn't be uploaded — the flag itself still matters more.
      console.error("Failed to upload flagged review image:", err.message);
    }

    await User.findByIdAndUpdate(user._id, {
      isFlagged: true,
      flagReason,
      flaggedAt: new Date(),
      ...(uploadResult && {
        flaggedImageUrl: uploadResult.url,
        flaggedImagePublicId: uploadResult.publicId,
      }),
    });
  }

  return { record, user, score, flagged };
};

const getAttendanceForUser = async (userId) => {
  return AttendanceRecord.find({ user: userId }).sort({ markedAt: -1 });
};

const getAttendanceForOrganization = async (organizationId, { from, to, category } = {}) => {
  const query = { organization: organizationId };
  if (from || to) {
    query.markedAt = {};
    if (from) query.markedAt.$gte = new Date(from);
    if (to) query.markedAt.$lt = new Date(to);
  }
  if (category) query.category = category;
  return AttendanceRecord.find(query).populate("user", "name email").sort({ markedAt: -1 });
};

export { markAttendance, getAttendanceForUser, getAttendanceForOrganization };