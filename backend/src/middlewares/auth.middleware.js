import jwt from "jsonwebtoken";

import { User } from "../models/User.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { env } from "../config/env.js";

/**
 * Verifies the access token (from httpOnly cookie or Authorization header),
 * attaches the corresponding user to req.user, and lets the request continue.
 * Mount this on any route that requires a logged-in user.
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

  const user = await User.findById(decoded._id).select("-password -refreshToken");
  if (!user) {
    throw new ApiError(401, "User for this token no longer exists");
  }
  if (!user.isActive) {
    throw new ApiError(403, "This account has been deactivated. Contact your organization admin.");
  }

  req.user = user;
  next();
});

export { verifyJWT };