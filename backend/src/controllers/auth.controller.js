import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import * as authService from "../services/auth.service.js";

// Shared cookie settings for both access and refresh tokens.
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
};

const register = asyncHandler(async (req, res) => {
  const { name, email, password, organizationName, organizationCode, categories } = req.body;

  const { person, membership, accessToken, refreshToken } = await authService.registerAdmin({
    name,
    email,
    password,
    organizationName,
    organizationCode,
    categories,
  });

  const safeUser = {
    _id: person._id,
    name: person.name,
    email: person.email,
    role: membership.role,
    organization: membership.organization,
  };

  res
    .status(201)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(new ApiResponse(201, { user: safeUser }, "Organization and admin account created"));
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const { person, membership, accessToken, refreshToken } = await authService.loginUser({
    email,
    password,
  });

  const safeUser = {
    _id: person._id,
    name: person.name,
    email: person.email,
    role: membership.role,
    organization: membership.organization,
  };

  res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(new ApiResponse(200, { user: safeUser }, "Logged in successfully"));
});

const refresh = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies?.refreshToken;

  const { accessToken, refreshToken } = await authService.refreshAccessToken(
    incomingRefreshToken
  );

  res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(new ApiResponse(200, {}, "Access token refreshed"));
});

const logout = asyncHandler(async (req, res) => {
  await authService.logoutUser(req.user._id);

  res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, {}, "Logged out successfully"));
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  await authService.forgotPassword(email);

  // Always the same response, whether or not the email exists — prevents
  // using this endpoint to check which emails are registered.
  res
    .status(200)
    .json(new ApiResponse(200, {}, "If that email is registered, a reset link has been sent"));
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  await authService.resetPassword(token, password);

  res.status(200).json(new ApiResponse(200, {}, "Password reset successfully. Please log in"));
});

const setInitialPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  await authService.setInitialPassword(token, password);

  res.status(200).json(new ApiResponse(200, {}, "Password set successfully. Please log in"));
});

/**
 * Lists every ACTIVE membership of the logged-in person (one per org),
 * flagging which one this session is currently in. Pending invites are
 * deliberately not included — those stay on the Dashboard card.
 */
const listMyOrganizations = asyncHandler(async (req, res) => {
  const organizations = await authService.listMyOrganizations(req.user._id, req.user.membershipId);

  res.status(200).json(new ApiResponse(200, { organizations }, "Organizations fetched"));
});

/**
 * Switches the session to another org the person is an active member of:
 * re-issues the access + refresh cookies scoped to that membership.
 */
const switchOrganization = asyncHandler(async (req, res) => {
  const { membershipId } = req.body;
  if (!membershipId) {
    throw new ApiError(400, "membershipId is required");
  }

  const { person, membership, accessToken, refreshToken } = await authService.switchOrganization(
    req.user._id,
    membershipId
  );

  const safeUser = {
    _id: person._id,
    name: person.name,
    email: person.email,
    role: membership.role,
    organization: membership.organization,
  };

  res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(new ApiResponse(200, { user: safeUser }, "Switched organization"));
});

export {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  setInitialPassword,
  listMyOrganizations,
  switchOrganization,
};