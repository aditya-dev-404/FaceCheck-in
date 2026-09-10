import { Organization } from "../models/Organization.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import * as attendanceService from "../services/attendance.service.js";

/**
 * Kiosk-facing recognition endpoint — no member/admin login involved.
 * Whoever is standing in front of the kiosk gets identified purely by
 * the face match itself; req.kioskOrganizationId (set by verifyKioskSecret)
 * only scopes which organization's enrolled faces to search.
 */
const recognize = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "An image file is required");
  }

  const { results, skippedCount, totalDetected } = await attendanceService.markAttendance(
    req.file.buffer,
    req.file.originalname,
    req.file.mimetype,
    req.kioskOrganizationId,
    "kiosk"
  );

  res.status(200).json(new ApiResponse(200, { results, skippedCount, totalDetected }, "Attendance processed"));
});

/**
 * Kiosk branding — gated behind the same org code + secret headers as
 * /recognize, so no new unauthenticated surface is added just to show a
 * logo. Called once when the kiosk activates.
 */
const getInfo = asyncHandler(async (req, res) => {
  const organization = await Organization.findById(req.kioskOrganizationId).select("name logoUrl");
  if (!organization) {
    throw new ApiError(404, "Organization not found");
  }

  res.status(200).json(new ApiResponse(200, { organization }, "Kiosk info fetched"));
});

export { recognize, getInfo };