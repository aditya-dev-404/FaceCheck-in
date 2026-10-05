import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";

import { Person } from "../models/Person.model.js";
import { Membership } from "../models/Membership.model.js";
import { Organization } from "../models/Organization.model.js";
import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";
import { sendPasswordResetEmail } from "./email.service.js";

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

// NOTE: a Person can hold several ACTIVE Memberships (one per org). Login
// resolves to the org they last used (Person.lastActiveOrganization),
// falling back to the first usable one; they can change org afterwards via
// switchOrganization below. "pending" Memberships (unaccepted invites) are
// always excluded so logging in never grants access to an org that hasn't
// been accepted yet.

const generateAccessToken = (person, membership) => {
  return jwt.sign(
    {
      _id: person._id,
      email: person.email,
      role: membership.role,
      organization: membership.organization,
      membershipId: membership._id,
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
};

const generateRefreshToken = (person, membership) => {
  return jwt.sign(
    { _id: person._id, organization: membership.organization, membershipId: membership._id },
    env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
};

/**
 * Issues a fresh access+refresh pair for a person and persists the refresh
 * token on the Person document (rotate-on-refresh: the old one is invalid
 * the moment a new one is issued). Also records the org as the person's
 * last-used one, so every login/register/switch/refresh keeps it current.
 */
const generateTokens = async (person, membership) => {
  const accessToken = generateAccessToken(person, membership);
  const refreshToken = generateRefreshToken(person, membership);

  person.refreshToken = refreshToken;
  person.lastActiveOrganization = membership.organization;
  await person.save({ validateBeforeSave: false });

  return { accessToken, refreshToken };
};

/**
 * Registers the FIRST admin of a brand-new organization. This is the only
 * self-service signup in the app — regular members are never created this
 * way; an admin adds them directly (see addMember in user.controller.js).
 *
 * NOTE: if a Person with this email already exists (e.g. they're already
 * an admin/member of another org), this still errors out rather than
 * attaching a second Membership to them — letting an existing account
 * "join" a new org via register is the multi-org feature itself and needs
 * its own authenticated flow, not this public endpoint.
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
  const existingPerson = await Person.findOne({ email });

  if (existingPerson) {
    throw new ApiError(409, "A user with this email already exists");
  }
  const RESERVED_CATEGORIES = ["admin"];

  const validateCategories = (categories) => {
    const hasReserved = categories.some((c) => RESERVED_CATEGORIES.includes(c.trim().toLowerCase()));
    if (hasReserved) {
      throw new ApiError(400, `"Admin" is a reserved category name and cannot be used`);
    }
  };
  validateCategories(categories);
  const organization = await Organization.create({
    name: organizationName,
    code: organizationCode,
    categories,
  });

  const person = await Person.create({
    name,
    email,
    password,
  });

  const membership = await Membership.create({
    person: person._id,
    organization: organization._id,
    role: "admin",
    category: "Admin", // fixed system category, always assigned to admins, not part of the org's editable category list
    status: "active",
  });

  const { accessToken, refreshToken } = await generateTokens(person, membership);

  return { person, membership, accessToken, refreshToken };
};

const loginUser = async ({ email, password }) => {
  const person = await Person.findOne({ email });
  if (!person) throw new ApiError(401, "Invalid email or password");

  if (!person.password) {
    throw new ApiError(403, "Account not activated yet — check your email to set a password");
  }

  const isPasswordValid = await bcrypt.compare(password, person.password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid email or password");
  }

  // status: "active" filter is deliberate — a pending invite must never be
  // usable to log into that org.
  const memberships = await Membership.find({ person: person._id, status: "active" });
  if (memberships.length === 0) {
    throw new ApiError(403, "This account is not linked to any organization");
  }

  // Deactivated memberships can't be logged into — skip them when choosing.
  const usable = memberships.filter((m) => m.isActive);
  if (usable.length === 0) {
    throw new ApiError(403, "This account has been deactivated. Contact your organization admin.");
  }

  // Prefer the org they last used; otherwise just the first usable one.
  const lastOrgId = person.lastActiveOrganization?.toString();
  const membership =
    usable.find((m) => m.organization.toString() === lastOrgId) || usable[0];

  const { accessToken, refreshToken } = await generateTokens(person, membership);

  return { person, membership, accessToken, refreshToken };
};

/**
 * Verifies an incoming refresh token against both its signature and the
 * value stored on the person, then rotates it (issues + stores a new one).
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

  const person = await Person.findById(decoded._id);
  if (!person || person.refreshToken !== incomingRefreshToken) {
    throw new ApiError(401, "Refresh token is expired or has been reused");
  }

  const membership = await Membership.findById(decoded.membershipId);
  if (!membership || membership.status !== "active" || !membership.isActive) {
    throw new ApiError(403, "This account has been deactivated. Contact your organization admin.");
  }

  return generateTokens(person, membership);
};

const logoutUser = async (personId) => {
  await Person.findByIdAndUpdate(personId, { $set: { refreshToken: null } });
};

/**
 * Lists the person's ACTIVE memberships (one per org) for the org switcher
 * and the My Organizations page. Deactivated ones are still returned (with
 * isActive:false) so the UI can show them greyed out; switching into them
 * is blocked in switchOrganization. Pending invites are not included.
 */
const listMyOrganizations = async (personId, currentMembershipId) => {
  const memberships = await Membership.find({ person: personId, status: "active" })
    .select("organization role category isActive")
    .populate("organization", "name logoUrl");

  return memberships
    .filter((m) => m.organization) // guard against an org that was deleted
    .map((m) => ({
      membershipId: m._id,
      organization: {
        _id: m.organization._id,
        name: m.organization.name,
        logoUrl: m.organization.logoUrl,
      },
      role: m.role,
      category: m.category,
      isActive: m.isActive,
      isCurrent: String(m._id) === String(currentMembershipId),
    }))
    .sort((a, b) => a.organization.name.localeCompare(b.organization.name));
};

/**
 * Moves the session into another org. The membership must belong to this
 * person, be accepted ("active" status) and not be deactivated. Rotates
 * both tokens to the new membership, so the old org's access token stops
 * being the one in the cookie.
 */
const switchOrganization = async (personId, membershipId) => {
  const membership = await Membership.findOne({
    _id: membershipId,
    person: personId,
    status: "active",
  });
  if (!membership) {
    throw new ApiError(404, "Organization membership not found");
  }
  if (!membership.isActive) {
    throw new ApiError(403, "Your account in this organization has been deactivated.");
  }

  const person = await Person.findById(personId);
  if (!person) {
    throw new ApiError(404, "Account not found");
  }

  const { accessToken, refreshToken } = await generateTokens(person, membership);

  return { person, membership, accessToken, refreshToken };
};

const RESET_TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Generates a reset token, stores only its SHA-256 hash (never the raw
 * token) with a 15-minute expiry, and emails the raw token as a link.
 * Always resolves without error even if the email doesn't exist, so this
 * endpoint can't be used to enumerate registered emails.
 */
const forgotPassword = async (email) => {
  const person = await Person.findOne({ email });
  if (!person) return; // silently no-op — don't reveal whether the email exists

  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

  person.resetPasswordToken = hashedToken;
  person.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);
  await person.save({ validateBeforeSave: false });

  const resetUrl = `${env.CLIENT_URL}/reset-password/${rawToken}`;

  try {
    await sendPasswordResetEmail(person.email, resetUrl);
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

  const person = await Person.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: new Date() },
  });

  if (!person) {
    throw new ApiError(400, "Password reset link is invalid or has expired");
  }

  person.password = newPassword; // plain — pre-save hook hashes it once
  person.resetPasswordToken = null;
  person.resetPasswordExpires = null;
  person.refreshToken = null; // force re-login everywhere after a password reset
  await person.save({ validateBeforeSave: false });
};

const setInitialPassword = async (rawToken, newPassword) => {
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

  const person = await Person.findOne({
    setPasswordToken: hashedToken,
    setPasswordExpires: { $gt: new Date() },
  });
  if (!person) throw new ApiError(400, "This link is invalid or has expired");

  person.password = newPassword; // pre-save hook hashes it
  person.setPasswordToken = null;
  person.setPasswordExpires = null;
  await person.save();
};

export {
  registerAdmin,
  loginUser,
  refreshAccessToken,
  logoutUser,
  listMyOrganizations,
  switchOrganization,
  forgotPassword,
  resetPassword,
  setInitialPassword,
};