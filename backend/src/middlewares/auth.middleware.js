import jwt from "jsonwebtoken";

import { Person } from "../models/Person.model.js";
import { Membership } from "../models/Membership.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { env } from "../config/env.js";

/**
 * Verifies the access token (from httpOnly cookie or Authorization header),
 * resolves the Person + their active Membership, and attaches a merged
 * object to req.user so existing code that reads req.user.role,
 * req.user.organization, req.user.category, etc. keeps working unchanged.
 * The raw Membership doc is also attached as req.membership for anything
 * that needs it directly. Mount this on any route that requires a
 * logged-in user.
 */
const verifyJWT = asyncHandler(async (req, res, next) => {
  const token =
    req.cookies?.accessToken ||
    req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    throw new ApiError(401, "Unauthorized request: no access token provided");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  } catch {
    throw new ApiError(401, "Invalid or expired access token");
  }

  const person = await Person.findById(decoded._id).select("-password -refreshToken");
  if (!person) {
    throw new ApiError(401, "User for this token no longer exists");
  }

  const membership = await Membership.findById(decoded.membershipId);
  if (!membership) {
    throw new ApiError(401, "Membership for this token no longer exists");
  }
  if (!membership.isActive) {
    throw new ApiError(403, "This account has been deactivated. Contact your organization admin.");
  }

  req.user = {
    ...person.toObject(),
    role: membership.role,
    organization: membership.organization,
    category: membership.category,
    isEnrolled: membership.isEnrolled,
    isActive: membership.isActive,
    isFlagged: membership.isFlagged,
    flagReason: membership.flagReason,
    flaggedAt: membership.flaggedAt,
    flaggedImageUrl: membership.flaggedImageUrl,
    flaggedImagePublicId: membership.flaggedImagePublicId,
    membershipId: membership._id,
  };
  req.membership = membership;

  next();
});

export { verifyJWT };