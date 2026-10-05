import mongoose from "mongoose";
import { Person } from "../models/Person.model.js";
import { Membership } from "../models/Membership.model.js";
import { FaceEmbedding } from "../models/FaceEmbedding.model.js";
import { AttendanceRecord } from "../models/AttendanceRecord.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { getMemberAnalytics } from "../services/analytics.service.js";

// All handlers here are admin-only (see user.routes.js) and scoped by
// (req.params.id = Person._id) + req.user.organization + role "member",
// so an admin can only ever read members of their own organization.

const findMemberOrThrow = async (personId, organization) => {
  if (!mongoose.isValidObjectId(personId)) {
    throw new ApiError(404, "Member not found");
  }
  const membership = await Membership.findOne({ person: personId, organization, role: "member" });
  if (!membership) {
    throw new ApiError(404, "Member not found");
  }
  return membership;
};

// Defaults to the last 90 days (same as the analytics service). A "to" date is
// treated as inclusive of that whole day.
const parseRange = (query) => {
  const to = query.to ? new Date(query.to) : new Date();
  if (query.to) to.setHours(23, 59, 59, 999);
  const from = query.from ? new Date(query.from) : new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new ApiError(400, "Invalid from/to date");
  }
  return { from, to };
};

const dayKey = (date) => date.toISOString().slice(0, 10);

// Consecutive weekdays with a check-in, counting back from today. Today not
// being checked in yet doesn't break the streak; weekends are skipped.
const computeStreak = (daySet) => {
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  const todayKey = dayKey(cursor);
  let streak = 0;
  for (let i = 0; i < 200; i++) {
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      if (daySet.has(dayKey(cursor))) streak++;
      else if (dayKey(cursor) !== todayKey) break;
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
};

const getMemberDetails = asyncHandler(async (req, res) => {
  const membership = await findMemberOrThrow(req.params.id, req.user.organization);

  const [person, embedding] = await Promise.all([
    Person.findById(membership.person).select("name email avatarUrl"),
    FaceEmbedding.findOne({ person: membership.person, organization: req.user.organization }).select("updatedAt"),
  ]);
  if (!person) {
    throw new ApiError(404, "Member not found");
  }

  const member = {
    _id: person._id,
    name: person.name,
    email: person.email,
    avatarUrl: person.avatarUrl,
    category: membership.category,
    status: membership.status,
    isActive: membership.isActive,
    isEnrolled: membership.isEnrolled,
    enrolledAt: embedding?.updatedAt ?? null,
    joinedAt: membership.createdAt,
    checkInTime: membership.checkInTime,
    gracePeriodMinutes: membership.gracePeriodMinutes,
    isFlagged: membership.isFlagged,
    flagReason: membership.flagReason,
    flaggedAt: membership.flaggedAt,
    flaggedImageUrl: membership.flaggedImageUrl,
  };

  res.status(200).json(new ApiResponse(200, { member }, "Member fetched"));
});

const getMemberStats = asyncHandler(async (req, res) => {
  const membership = await findMemberOrThrow(req.params.id, req.user.organization);
  const { from, to } = parseRange(req.query);
  const organization = req.user.organization;

  const streakWindowStart = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000);

  const [analytics, rangeRecords, lastRecord, dayAgg] = await Promise.all([
    getMemberAnalytics(membership.person, organization, { from: from.toISOString(), to: to.toISOString() }),
    AttendanceRecord.find({ person: membership.person, organization, markedAt: { $gte: from, $lte: to } }).select(
      "isFlagged lateBy"
    ),
    AttendanceRecord.findOne({ person: membership.person, organization }).sort({ markedAt: -1 }).select("markedAt"),
    AttendanceRecord.aggregate([
      { $match: { person: membership.person, organization, markedAt: { $gte: streakWindowStart } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$markedAt" } } } },
    ]),
  ]);

  const stats = {
    range: { from, to },
    attendanceRate: analytics.myRate,
    categoryAvgRate: analytics.categoryAvgRate,
    rank: analytics.rank,
    totalInCategory: analytics.totalInCategory,
    totalPresent: rangeRecords.length,
    lateCount: rangeRecords.filter((r) => r.lateBy).length,
    lateRate: analytics.lateRate,
    avgLateMinutes: analytics.avgLateMinutes,
    flaggedCount: rangeRecords.filter((r) => r.isFlagged).length,
    lastCheckIn: lastRecord?.markedAt ?? null,
    streak: computeStreak(new Set(dayAgg.map((d) => d._id))),
    weeklyTrend: analytics.weeklyTrend,
  };

  res.status(200).json(new ApiResponse(200, stats, "Member stats fetched"));
});

const getMemberAttendance = asyncHandler(async (req, res) => {
  const membership = await findMemberOrThrow(req.params.id, req.user.organization);
  const { from, to } = parseRange(req.query);

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);

  const filter = {
    person: membership.person,
    organization: req.user.organization,
    markedAt: { $gte: from, $lte: to },
  };

  const [records, total] = await Promise.all([
    AttendanceRecord.find(filter)
      .sort({ markedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("markedAt matchScore lateBy isFlagged markedVia"),
    AttendanceRecord.countDocuments(filter),
  ]);

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { records, total, page, pages: Math.max(Math.ceil(total / limit), 1) },
        "Member attendance fetched"
      )
    );
});

const exportMemberAttendance = asyncHandler(async (req, res) => {
  const membership = await findMemberOrThrow(req.params.id, req.user.organization);
  const { from, to } = parseRange(req.query);

  const [person, records] = await Promise.all([
    Person.findById(membership.person).select("name"),
    AttendanceRecord.find({
      person: membership.person,
      organization: req.user.organization,
      markedAt: { $gte: from, $lte: to },
    })
      .sort({ markedAt: -1 })
      .select("markedAt matchScore lateBy isFlagged markedVia"),
  ]);

  const escapeCsv = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

  const header = ["Date", "Time", "Status", "Match Score", "Marked Via", "Flagged"].join(",");
  const rows = records.map((r) => {
    const d = new Date(r.markedAt);
    const status = r.lateBy || (membership.checkInTime ? "On time" : "—");
    return [
      escapeCsv(d.toISOString().slice(0, 10)),
      escapeCsv(d.toISOString().slice(11, 19) + " UTC"),
      escapeCsv(status),
      escapeCsv(r.matchScore.toFixed(4)),
      escapeCsv(r.markedVia),
      escapeCsv(r.isFlagged ? "Yes" : "No"),
    ].join(",");
  });

  const safeName = (person?.name || "member").replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="attendance-${safeName}-${Date.now()}.csv"`);
  res.status(200).send([header, ...rows].join("\n"));
});

export { getMemberDetails, getMemberStats, getMemberAttendance, exportMemberAttendance };