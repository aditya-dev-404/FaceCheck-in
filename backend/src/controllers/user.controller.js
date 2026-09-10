import bcrypt from "bcrypt";

import { User } from "../models/User.model.js";
import { FaceEmbedding } from "../models/FaceEmbedding.model.js";
import { Organization } from "../models/Organization.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { getEmbeddingsFromImage } from "../services/faceMatch.service.js";
import { deleteFlaggedImage, uploadAvatar, deleteImage } from "../services/cloudinary.service.js";
import { sendMemberWelcomeEmail } from "../services/email.service.js";
import { env } from "../config/env.js";
/**
 * Enrollment flow: capture -> detect -> align -> embed -> store.
 * The detect/align/embed steps happen inside the ML service; here we just
 * forward the image, validate exactly one face was found, and store the
 * resulting embedding against the logged-in user.
 */
const enrollFace = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "An image file is required");
  }

  const faces = await getEmbeddingsFromImage(
    req.file.buffer,
    req.file.originalname,
    req.file.mimetype
  );

  if (faces.length > 1) {
    throw new ApiError(400, "Multiple faces detected — enrollment requires a single face");
  }

  const { embedding } = faces[0];

  // Upsert: re-enrolling simply overwrites the previous embedding.
  await FaceEmbedding.findOneAndUpdate(
    { user: req.user._id },
    { user: req.user._id, organization: req.user.organization, embedding },
    { upsert: true, returnDocument: "after" }
  );

  await User.findByIdAndUpdate(req.user._id, { isEnrolled: true });

  res.status(200).json(new ApiResponse(200, {}, "Face enrolled successfully"));
});

const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .select("-password -refreshToken")
    .populate("organization", "name logoUrl");

  res.status(200).json(new ApiResponse(200, { user }, "Profile fetched"));
});

/**
 * Self-service: any logged-in user (member or admin) can set their own
 * avatar — a display picture only, never used for face recognition
 * (that relies solely on FaceEmbedding, created separately via enrollFace).
 */
const uploadMyAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "An image file is required");
  }

  const { url, publicId } = await uploadAvatar(req.file.buffer, req.user._id);

  await User.findByIdAndUpdate(req.user._id, { avatarUrl: url, avatarPublicId: publicId });

  res.status(200).json(new ApiResponse(200, { avatarUrl: url }, "Avatar updated"));
});

const removeMyAvatar = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (user.avatarPublicId) {
    await deleteImage(user.avatarPublicId);
  }

  user.avatarUrl = null;
  user.avatarPublicId = null;
  await user.save();

  res.status(200).json(new ApiResponse(200, {}, "Avatar removed"));
});

/**
 * Admin-only: adds a member to the admin's own organization, setting
 * their email/password directly. This is the only way a regular member
 * account gets created — there is no self-registration for members.
 */
const addMember = asyncHandler(async (req, res) => {
  const { name, email, password, category } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(409, "A user with this email already exists");
  }

  const organization = await Organization.findById(req.user.organization);
  if (category && !organization.categories.includes(category)) {
    throw new ApiError(
      400,
      `Invalid category. Valid categories for this organization: ${organization.categories.join(", ") || "(none defined yet)"}`
    );
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const member = await User.create({
    name,
    email,
    password: hashedPassword,
    organization: req.user.organization,
    role: "member",
    category: category || null,
  });

  await sendMemberWelcomeEmail(email, name, password, `${env.CLIENT_URL}/login`);

  res
    .status(201)
    .json(
      new ApiResponse(
        201,
        { user: { _id: member._id, name: member.name, email: member.email, category: member.category } },
        "Member added successfully"
      )
    );
});

/**
 * Admin-only: lists every member (never other admins) in the admin's
 * own organization, for the Manage Members dashboard.
 */
const listMembers = asyncHandler(async (req, res) => {
  const members = await User.find({ organization: req.user.organization, role: "member" })
    .select("name email category isEnrolled isActive isFlagged flagReason flaggedAt flaggedImageUrl")
    .sort({ isFlagged: -1, name: 1 });

  res.status(200).json(new ApiResponse(200, { members }, "Members fetched"));
});

/**
 * Admin-only: edits a member's name/email/category. Scoped to the admin's
 * own org and to role "member" so an admin can never edit another org's
 * users or another admin's account through this route.
 */
const updateMember = asyncHandler(async (req, res) => {
  const { name, email, category } = req.body;

  const member = await User.findOne({
    _id: req.params.id,
    organization: req.user.organization,
    role: "member",
  });
  if (!member) {
    throw new ApiError(404, "Member not found");
  }

  if (email && email !== member.email) {
    const existing = await User.findOne({ email });
    if (existing) {
      throw new ApiError(409, "A user with this email already exists");
    }
    member.email = email;
  }

  if (category) {
    const organization = await Organization.findById(req.user.organization);
    if (!organization.categories.includes(category)) {
      throw new ApiError(400, `Invalid category. Valid categories: ${organization.categories.join(", ")}`);
    }
    member.category = category;
  }

  if (name) member.name = name;

  await member.save();

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { user: { _id: member._id, name: member.name, email: member.email, category: member.category } },
        "Member updated"
      )
    );
});

/**
 * Admin-only: toggles a member's isActive flag. Deactivated members are
 * blocked at login and mid-session (see auth.service.js / auth.middleware.js)
 * but their data (attendance history, enrollment) is left intact — this is
 * reversible, unlike removeMember below.
 */
const setMemberActiveStatus = (isActive) =>
  asyncHandler(async (req, res) => {
    const member = await User.findOneAndUpdate(
      { _id: req.params.id, organization: req.user.organization, role: "member" },
      { isActive },
      { returnDocument: "after" }
    );
    if (!member) {
      throw new ApiError(404, "Member not found");
    }

    res
      .status(200)
      .json(new ApiResponse(200, { user: { _id: member._id, isActive: member.isActive } }, isActive ? "Member reactivated" : "Member deactivated"));
  });

/**
 * Admin-only: permanently deletes a member and their FaceEmbedding.
 * AttendanceRecords are deliberately kept (they already snapshot
 * category/name/email at mark time) so historical exports stay accurate
 * even after the account is gone.
 */
const removeMember = asyncHandler(async (req, res) => {
  const member = await User.findOne({
    _id: req.params.id,
    organization: req.user.organization,
    role: "member",
  });
  if (!member) {
    throw new ApiError(404, "Member not found");
  }

  await FaceEmbedding.deleteOne({ user: member._id });
  await member.deleteOne();

  res.status(200).json(new ApiResponse(200, {}, "Member removed"));
});

/**
 * Admin-only: clears a member's flag after review. The flag on any
 * individual AttendanceRecord that triggered it is left as-is — it's a
 * historical fact ("this record scored X") — only the member-level
 * "needs review" flag is cleared here. Also cleans up the review image,
 * if one exists, since there's no reason to keep it once reviewed.
 */
const unflagMember = asyncHandler(async (req, res) => {
  const member = await User.findOne({
    _id: req.params.id,
    organization: req.user.organization,
    role: "member",
  });
  if (!member) {
    throw new ApiError(404, "Member not found");
  }

  if (member.flaggedImagePublicId) {
    await deleteFlaggedImage(member.flaggedImagePublicId).catch((err) =>
      console.error("Failed to delete flagged image on unflag:", err.message)
    );
  }

  member.isFlagged = false;
  member.flagReason = null;
  member.flaggedAt = null;
  member.flaggedImageUrl = null;
  member.flaggedImagePublicId = null;
  await member.save();

  res.status(200).json(new ApiResponse(200, { user: { _id: member._id } }, "Member unflagged"));
});

/**
 * Admin-only: deletes just the flagged-review image, independent of the
 * flag itself — the member can remain flagged with no image attached
 * (e.g. admin already looked at it and doesn't need to keep it on file).
 */
const deleteFlagImage = asyncHandler(async (req, res) => {
  const member = await User.findOne({
    _id: req.params.id,
    organization: req.user.organization,
    role: "member",
  });
  if (!member) {
    throw new ApiError(404, "Member not found");
  }
  if (!member.flaggedImagePublicId) {
    throw new ApiError(404, "No flagged image to delete");
  }

  await deleteFlaggedImage(member.flaggedImagePublicId);
  member.flaggedImageUrl = null;
  member.flaggedImagePublicId = null;
  await member.save();

  res.status(200).json(new ApiResponse(200, {}, "Flagged image deleted"));
});

export {
  enrollFace,
  getProfile,
  uploadMyAvatar,
  removeMyAvatar,
  addMember,
  listMembers,
  updateMember,
  setMemberActiveStatus,
  removeMember,
  unflagMember,
  deleteFlagImage,
};
