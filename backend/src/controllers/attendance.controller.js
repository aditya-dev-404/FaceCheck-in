import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import * as attendanceService from "../services/attendance.service.js";

/**
 * Recognition flow: capture -> detect -> align -> embed -> compare ->
 * mark attendance -> write to DB. Detect/embed happen in the ML service;
 * everything from "compare" onward is handled in attendance.service.js.
 */
const markAttendance = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "An image file is required");
  }

  const { record, user, score, flagged } = await attendanceService.markAttendance(
    req.file.buffer,
    req.file.originalname,
    req.file.mimetype,
    req.user.organization,
    "admin"
  );

  res.status(201).json(
    new ApiResponse(
      201,
      {
        user: { _id: user._id, name: user.name, email: user.email },
        matchScore: score,
        markedAt: record.markedAt,
        flagged,
      },
      flagged
        ? `Attendance marked for ${user.name} (flagged for admin review — low match confidence)`
        : `Attendance marked for ${user.name}`
    )
  );
});

const getMyAttendance = asyncHandler(async (req, res) => {
  const records = await attendanceService.getAttendanceForUser(req.user._id);
  res.status(200).json(new ApiResponse(200, { records }, "Attendance history fetched"));
});

const getOrganizationAttendance = asyncHandler(async (req, res) => {
  const { from, to, category } = req.query;
  const records = await attendanceService.getAttendanceForOrganization(req.user.organization, {
    from,
    to,
    category,
  });
  res.status(200).json(new ApiResponse(200, { records }, "Organization attendance fetched"));
});

/**
 * Admin-only: streams the org's attendance (optionally filtered by
 * category/date range) as a downloadable CSV file, instead of JSON.
 */
const exportOrganizationAttendance = asyncHandler(async (req, res) => {
  const { from, to, category } = req.query;
  const records = await attendanceService.getAttendanceForOrganization(req.user.organization, {
    from,
    to,
    category,
  });

  const escapeCsv = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

  const header = ["Name", "Email", "Category", "Marked At", "Match Score"].join(",");
  const rows = records.map((r) =>
    [
      escapeCsv(r.user?.name),
      escapeCsv(r.user?.email),
      escapeCsv(r.category),
      escapeCsv(new Date(r.markedAt).toISOString()),
      escapeCsv(r.matchScore.toFixed(4)),
    ].join(",")
  );

  const csv = [header, ...rows].join("\n");
  const filenameSuffix = category ? `-${category}` : "";

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="attendance${filenameSuffix}-${Date.now()}.csv"`
  );
  res.status(200).send(csv);
});

export { markAttendance, getMyAttendance, getOrganizationAttendance, exportOrganizationAttendance };