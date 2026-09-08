import bcrypt from "bcrypt";

import { Organization } from "../models/Organization.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * Authenticates a kiosk device — a fixed, unattended station at an
 * organization's premises, not a person. Uses a static org code + secret
 * pair sent as headers on every request, rather than a JWT/session, since
 * a kiosk has no user to log in as and shouldn't need session UX.
 * Attaches req.kioskOrganizationId on success.
 */
const verifyKioskSecret = asyncHandler(async (req, res, next) => {
  const orgCode = req.header("X-Org-Code");
  const kioskSecret = req.header("X-Kiosk-Secret");

  if (!orgCode || !kioskSecret) {
    throw new ApiError(401, "Kiosk credentials missing");
  }

  const organization = await Organization.findOne({ code: orgCode.toUpperCase() });
  if (!organization) {
    throw new ApiError(401, "Invalid organization code");
  }

  if (!organization.kioskSecretHash) {
    throw new ApiError(400, "No kiosk has been configured for this organization yet");
  }

  const isValid = await bcrypt.compare(kioskSecret, organization.kioskSecretHash);
  if (!isValid) {
    throw new ApiError(401, "Invalid kiosk secret");
  }

  req.kioskOrganizationId = organization._id;
  next();
});

export { verifyKioskSecret };