import jwt from "jsonwebtoken";

import { Person } from "../models/Person.model.js";
import { Membership } from "../models/Membership.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { env } from "../config/env.js";

/**
 * Verifies the access token (httpOnly cookie or Authorization header),
 * loads the Person, then looks up that person's single ACTIVE Membership
 * (a person can only have one). Attaches a merged object to req.user so
 * code reading req.user.role / organization / category / etc. keeps working,
 * plus the raw Membership as req.membership.
 *
 * The token only identifies the person — the organization is always
 * resolved fresh from the database, so joining, leaving or being removed
 * takes effect immediately without re-issuing tokens.
 */
const authenticate = async (req, { requireOrganization }) => {
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

  const membership = await Membership.findOne({ person: person._id, status: "active" });

  if (membership && !membership.isActive) {
    throw new ApiError(403, "This account has been deactivated. Contact your organization admin.");
  }
  if (!membership && requireOrganization) {
    throw new ApiError(403, "You are not part of any organization right now");
  }

  req.user = {
    ...person.toObject(),
    role: membership?.role ?? null,
    organization: membership?.organization ?? null,
    category: membership?.category ?? null,
    isEnrolled: membership?.isEnrolled ?? false,
    isActive: membership?.isActive ?? true,
    isFlagged: membership?.isFlagged ?? false,
    flagReason: membership?.flagReason ?? null,
    flaggedAt: membership?.flaggedAt ?? null,
    flaggedImageUrl: membership?.flaggedImageUrl ?? null,
    flaggedImagePublicId: membership?.flaggedImagePublicId ?? null,
    membershipId: membership?._id ?? null,
  };
  req.membership = membership;
};

/** Requires a logged-in person who currently belongs to an organization. */
const verifyJWT = asyncHandler(async (req, res, next) => {
  await authenticate(req, { requireOrganization: true });
  next();
});

/**
 * Requires a logged-in person, but allows one with no active organization
 * (e.g. they left, were removed, or were never accepted anywhere yet).
 * Used for profile, avatar, invites and logout.
 */
const verifyPerson = asyncHandler(async (req, res, next) => {
  await authenticate(req, { requireOrganization: false });
  next();
});

export { verifyJWT, verifyPerson };