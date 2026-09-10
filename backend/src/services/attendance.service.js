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
const MAX_FACES_PER_CAPTURE = 5;

const bboxArea = (bbox) => {
  const [x1, y1, x2, y2] = bbox;
  return Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
};

/**
 * Batch recognition flow: image -> detect/embed ALL faces (ML service) ->
 * sort largest-first, cap at MAX_FACES_PER_CAPTURE -> match + mark each
 * independently. Each face's outcome is collected rather than thrown, so
 * one unrecognized/duplicate face in a group doesn't block the rest.
 */
const markAttendance = async (imageBuffer, filename, mimetype, organizationId, markedVia = "kiosk") => {
  const allFaces = await getEmbeddingsFromImage(imageBuffer, filename, mimetype);

  const sortedFaces = [...allFaces].sort((a, b) => bboxArea(b.bbox) - bboxArea(a.bbox));
  const facesToProcess = sortedFaces.slice(0, MAX_FACES_PER_CAPTURE);
  const skippedCount = sortedFaces.length - facesToProcess.length;

  const results = [];

  for (const face of facesToProcess) {
    const { matched, score, user, flagged } = await findBestMatch(face.embedding, organizationId);

    if (!matched) {
      results.push({ status: "not-recognized", score });
      continue;
    }

    const { start, end } = getTodayRange();
    const alreadyMarked = await AttendanceRecord.findOne({
      user: user._id,
      markedAt: { $gte: start, $lt: end },
    });

    if (alreadyMarked) {
      results.push({ status: "already-marked", name: user.name, userId: user._id, score });
      continue;
    }

    const flagReason = flagged ? `Borderline face match confidence (score: ${score.toFixed(4)})` : null;

    await AttendanceRecord.create({
      user: user._id,
      organization: organizationId,
      matchScore: score,
      category: user.category || null,
      memberName: user.name,
      memberEmail: user.email,
      isFlagged: flagged,
      markedVia,
    });

    if (flagged) {
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

    results.push({ status: flagged ? "flagged" : "marked", name: user.name, userId: user._id, score });
  }

  return { results, skippedCount, totalDetected: sortedFaces.length };
};

const getAttendanceForUser = async (userId, { page, limit } = {}) => {
  const query = { user: userId };

  if (!page && !limit) {
    return AttendanceRecord.find(query).sort({ markedAt: -1 });
  }

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.max(1, parseInt(limit) || 20);
  const skip = (pageNum - 1) * limitNum;

  const [records, totalRecords] = await Promise.all([
    AttendanceRecord.find(query).sort({ markedAt: -1 }).skip(skip).limit(limitNum),
    AttendanceRecord.countDocuments(query),
  ]);

  return { records, totalRecords, totalPages: Math.ceil(totalRecords / limitNum) || 1 };
};

const getAttendanceForOrganization = async (organizationId, { from, to, category, page, limit } = {}) => {
  const query = { organization: organizationId };
  if (from || to) {
    query.markedAt = {};
    if (from) query.markedAt.$gte = new Date(from);
    if (to) query.markedAt.$lt = new Date(to);
  }
  if (category) query.category = category;

  if (!page && !limit) {
    return AttendanceRecord.find(query).populate("user", "name email").sort({ markedAt: -1 });
  }

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.max(1, parseInt(limit) || 20);
  const skip = (pageNum - 1) * limitNum;

  const [records, totalRecords] = await Promise.all([
    AttendanceRecord.find(query).populate("user", "name email").sort({ markedAt: -1 }).skip(skip).limit(limitNum),
    AttendanceRecord.countDocuments(query),
  ]);

  return { records, totalRecords, totalPages: Math.ceil(totalRecords / limitNum) || 1 };
};

export { markAttendance, getAttendanceForUser, getAttendanceForOrganization };