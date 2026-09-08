import crypto from "crypto";
import bcrypt from "bcrypt";

import { Organization } from "../models/Organization.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { uploadOrgLogo, deleteImage } from "../services/cloudinary.service.js";

const getMyOrganization = asyncHandler(async (req, res) => {
  const organization = await Organization.findById(req.user.organization);
  if (!organization) {
    throw new ApiError(404, "Organization not found");
  }
  res.status(200).json(new ApiResponse(200, { organization }, "Organization fetched"));
});

/**
 * Lets an admin rename their org, change its join code, or replace its
 * category list entirely (the frontend sends the full updated list, not
 * a single add/remove). Categories already assigned to members aren't
 * retroactively touched if removed here.
 */
const updateMyOrganization = asyncHandler(async (req, res) => {
  const { name, code, categories } = req.body;

  const update = {};
  if (name) update.name = name;
  if (code) update.code = code;
  if (Array.isArray(categories)) update.categories = categories;

  if (update.code) {
    const existing = await Organization.findOne({
      code: update.code.toUpperCase(),
      _id: { $ne: req.user.organization },
    });
    if (existing) {
      throw new ApiError(409, "Another organization already uses this code");
    }
  }

  const organization = await Organization.findByIdAndUpdate(req.user.organization, update, {
    returnDocument: "after",
    runValidators: true,
  });

  res.status(200).json(new ApiResponse(200, { organization }, "Organization updated"));
});

/**
 * Generates a brand-new kiosk secret for the org, hashes it for storage,
 * and returns the RAW secret exactly once — it is never retrievable
 * again after this response. Calling this again immediately invalidates
 * any previously configured kiosk device (old secret stops matching).
 */
const generateKioskCredentials = asyncHandler(async (req, res) => {
  const rawSecret = crypto.randomBytes(24).toString("hex");
  const hashedSecret = await bcrypt.hash(rawSecret, 10);

  const organization = await Organization.findByIdAndUpdate(
    req.user.organization,
    { kioskSecretHash: hashedSecret },
    { returnDocument: "after" }
  );

  res.status(200).json(
    new ApiResponse(
      200,
      { organizationCode: organization.code, kioskSecret: rawSecret },
      "Kiosk credentials generated — save this secret now, it will not be shown again"
    )
  );
});

/**
 * Admin-only: uploads/replaces the org's logo, shown across the app to
 * every member of the organization. overwrite:true in the Cloudinary
 * helper means re-uploading with the same public_id replaces the old
 * image automatically, so no separate delete step is needed here.
 */
const uploadLogo = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "An image file is required");
  }

  const { url, publicId } = await uploadOrgLogo(req.file.buffer, req.user.organization);

  const organization = await Organization.findByIdAndUpdate(
    req.user.organization,
    { logoUrl: url, logoPublicId: publicId },
    { returnDocument: "after" }
  );

  res.status(200).json(new ApiResponse(200, { organization }, "Logo updated"));
});

const removeLogo = asyncHandler(async (req, res) => {
  const organization = await Organization.findById(req.user.organization);
  if (organization.logoPublicId) {
    await deleteImage(organization.logoPublicId);
  }

  organization.logoUrl = null;
  organization.logoPublicId = null;
  await organization.save();

  res.status(200).json(new ApiResponse(200, {}, "Logo removed"));
});

export { getMyOrganization, updateMyOrganization, generateKioskCredentials, uploadLogo, removeLogo };
