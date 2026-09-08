import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";

import { User } from "../models/User.model.js";
import { Organization } from "../models/Organization.model.js";
import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";
import { sendPasswordResetEmail } from "./email.service.js";

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

const generateAccessToken = (user) => {
  return jwt.sign(
    { _id: user._id, email: user.email, role: user.role, organization: user.organization },
    env.JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign({ _id: user._id }, env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });
};

/**
 * Issues a fresh access+refresh pair for a user and persists the refresh
 * token on the User document (rotate-on-refresh: the old one is invalid
 * the moment a new one is issued).
 */
const generateTokens = async (user) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  return { accessToken, refreshToken };
};

/**
 * Registers the FIRST admin of a brand-new organization. This is the only
 * self-service signup in the app — regular members are never created this
 * way; an admin adds them directly (see addMember in user.controller.js).
 */
const registerAdmin = async ({
  name,
  email,
  password,
  organizationName,
  organizationCode,
  categories = [],
}) => {
  const existingOrg = await Organization.findOne({ code: organizationCode.toUpperCase() });
  if (existingOrg) {
    throw new ApiError(409, "An organization with this code is already registered");
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(409, "A user with this email already exists");
  }

  const organization = await Organization.create({
    name: organizationName,
    code: organizationCode,
    categories,
  });

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    organization: organization._id,
    role: "admin",
    category: "Admin", // fixed system category, always assigned to admins, not part of the org's editable category list
  });

  const { accessToken, refreshToken } = await generateTokens(user);

  return { user, accessToken, refreshToken };
};

const loginUser = async ({ email, password }) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid email or password");
  }

  if (!user.isActive) {
    throw new ApiError(403, "This account has been deactivated. Contact your organization admin.");
  }

  const { accessToken, refreshToken } = await generateTokens(user);

  return { user, accessToken, refreshToken };
};

/**
 * Verifies an incoming refresh token against both its signature and the
 * value stored on the user, then rotates it (issues + stores a new one).
 */
const refreshAccessToken = async (incomingRefreshToken) => {
  if (!incomingRefreshToken) {
    throw new ApiError(401, "Refresh token missing");
  }

  let decoded;
  try {
    decoded = jwt.verify(incomingRefreshToken, env.JWT_REFRESH_SECRET);
  } catch {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  const user = await User.findById(decoded._id);
  if (!user || user.refreshToken !== incomingRefreshToken) {
    throw new ApiError(401, "Refresh token is expired or has been reused");
  }

  return generateTokens(user);
};

const logoutUser = async (userId) => {
  await User.findByIdAndUpdate(userId, { $set: { refreshToken: null } });
};

const RESET_TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Generates a reset token, stores only its SHA-256 hash (never the raw
 * token) with a 15-minute expiry, and emails the raw token as a link.
 * Always resolves without error even if the email doesn't exist, so this
 * endpoint can't be used to enumerate registered emails.
 */
const forgotPassword = async (email) => {
  const user = await User.findOne({ email });
  if (!user) return; // silently no-op — don't reveal whether the email exists

  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${env.CLIENT_URL}/reset-password/${rawToken}`;

  try {
    await sendPasswordResetEmail(user.email, resetUrl);
  } catch (err) {
    // Don't leak whatever status/shape Brevo's error comes back as (it can
    // coincidentally look like a 401 and get misread as an auth failure) —
    // surface a clean, accurate error instead.
    throw new ApiError(502, "Could not send the reset email. Please try again later.", [
      err.message,
    ]);
  }
};

const resetPassword = async (rawToken, newPassword) => {
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: new Date() },
  });

  if (!user) {
    throw new ApiError(400, "Password reset link is invalid or has expired");
  }

  user.password = await bcrypt.hash(newPassword, 10);
  user.resetPasswordToken = null;
  user.resetPasswordExpires = null;
  user.refreshToken = null; // force re-login everywhere after a password reset
  await user.save({ validateBeforeSave: false });
};

export {
  registerAdmin,
  loginUser,
  refreshAccessToken,
  logoutUser,
  forgotPassword,
  resetPassword,
};