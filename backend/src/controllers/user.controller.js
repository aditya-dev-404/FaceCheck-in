import bcrypt from "bcrypt";

import { Person } from "../models/Person.model.js";
import { Membership } from "../models/Membership.model.js";
import { FaceEmbedding } from "../models/FaceEmbedding.model.js";
import { Organization } from "../models/Organization.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { getEmbeddingsFromImage } from "../services/faceMatch.service.js";
import { deleteFlaggedImage, uploadAvatar, deleteImage } from "../services/cloudinary.service.js";
import { sendSetPasswordEmail, sendMemberInviteEmail } from "../services/email.service.js";
import { env } from "../config/env.js";
import crypto from "crypto";

// Member-management helpers below are all scoped by (person id from
// req.params.id) + (req.user.organization) + role:"member", so an admin
// can never touch another org's people or another admin's Membership.
// req.params.id is a Person._id — this stayed stable across the
// User -> Person/Membership migration (Person._id === old User._id), so
// no frontend changes were needed for these routes.

/**
 * Enrollment flow: capture -> detect -> align -> embed -> store.
 * The detect/align/embed steps happen inside the ML service; here we just
 * forward the image, validate exactly one face was found, and store the
 * resulting embedding against the logged-in person's active membership.
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

  // Upsert: re-enrolling simply overwrites the previous embedding for this org.
  await FaceEmbedding.findOneAndUpdate(
    { person: req.user._id, organization: req.user.organization },
    { person: req.user._id, organization: req.user.organization, embedding },
    { upsert: true, returnDocument: "after" }
  );

  await Membership.findByIdAndUpdate(req.user.membershipId, { isEnrolled: true });

  res.status(200).json(new ApiResponse(200, {}, "Face enrolled successfully"));
});

const getProfile = asyncHandler(async (req, res) => {
  const person = await Person.findById(req.user._id).select("-password -refreshToken");

  const membership = await Membership.findById(req.user.membershipId).populate(
    "organization",
    "name logoUrl"
  );

  const profile = {
    _id: person._id,
    name: person.name,
    email: person.email,
    avatarUrl: person.avatarUrl,
    role: membership.role,
    category: membership.category,
    isEnrolled: membership.isEnrolled,
    organization: membership.organization,
  };

  res.status(200).json(new ApiResponse(200, { user: profile }, "Profile fetched"));
});

/**
 * Self-service: any logged-in person (member or admin) can set their own
 * avatar — a display picture only, never used for face recognition
 * (that relies solely on FaceEmbedding, created separately via enrollFace).
 * Lives on Person since it's a global identity trait, not per-org.
 */
const uploadMyAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "An image file is required");
  }

  const { url, publicId } = await uploadAvatar(req.file.buffer, req.user._id);

  await Person.findByIdAndUpdate(req.user._id, { avatarUrl: url, avatarPublicId: publicId });

  res.status(200).json(new ApiResponse(200, { avatarUrl: url }, "Avatar updated"));
});

const removeMyAvatar = asyncHandler(async (req, res) => {
  const person = await Person.findById(req.user._id);
  if (person.avatarPublicId) {
    await deleteImage(person.avatarPublicId);
  }

  person.avatarUrl = null;
  person.avatarPublicId = null;
  await person.save();

  res.status(200).json(new ApiResponse(200, {}, "Avatar removed"));
});

/**
 * Self-service: lists this person's own pending invites (Memberships with
 * status "pending") across any organization, for a "you've been invited"
 * banner/notice in the frontend. A person can be logged into org A while
 * having a pending invite to org B, so this doesn't filter by
 * req.user.organization.
 */
const listMyInvites = asyncHandler(async (req, res) => {
  const invites = await Membership.find({ person: req.user._id, status: "pending" })
    .select("category createdAt")
    .populate("organization", "name logoUrl");

  const formatted = invites.map((m) => ({
    membershipId: m._id,
    organization: m.organization,
    category: m.category,
    invitedAt: m.createdAt,
  }));

  res.status(200).json(new ApiResponse(200, { invites: formatted }, "Pending invites fetched"));
});

/**
 * Self-service: accepts a pending invite belonging to the logged-in
 * person. Flips the Membership to "active" and — the whole point of
 * reusing one identity across orgs — copies an existing FaceEmbedding
 * from any of the person's other orgs into this one, so they don't have
 * to re-enroll. If they have no embedding anywhere yet (shouldn't happen
 * for an existing Person, but just in case), the Membership still
 * activates and isEnrolled simply stays false until they self-enroll.
 */
const acceptInvite = asyncHandler(async (req, res) => {
  const membership = await Membership.findOne({
    _id: req.params.membershipId,
    person: req.user._id,
    status: "pending",
  });
  if (!membership) {
    throw new ApiError(404, "No pending invite found");
  }

  const existingEmbedding = await FaceEmbedding.findOne({ person: req.user._id });

  if (existingEmbedding) {
    await FaceEmbedding.findOneAndUpdate(
      { person: req.user._id, organization: membership.organization },
      { person: req.user._id, organization: membership.organization, embedding: existingEmbedding.embedding },
      { upsert: true }
    );
    membership.isEnrolled = true;
  }

  membership.status = "active";
  await membership.save();

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { membership: { _id: membership._id, organization: membership.organization, isEnrolled: membership.isEnrolled } },
        existingEmbedding
          ? "Invite accepted — your existing face enrollment was reused"
          : "Invite accepted — please enroll your face to start marking attendance here"
      )
    );
});

/**
 * Admin-only: adds a member to the admin's own organization.
 *
 * Branches on whether a Person with this email already exists:
 *  - NEW email -> today's flow: create Person + active Membership, admin
 *    sets the initial password, welcome email sent.
 *  - EXISTING email -> INVITE flow: create a "pending" Membership only
 *    (no password field involved — they already have one), an invite
 *    email is sent instead of a welcome email. The Membership doesn't
 *    count for attendance/dashboards/kiosk matching until the person logs
 *    in and accepts it via acceptInvite above.
 */
const SET_PASSWORD_TOKEN_EXPIRY_MS = 48 * 60 * 60 * 1000; // 24 hours — longer than the reset-password window since this is a one-time welcome link, not a security-sensitive reset

const addMember = asyncHandler(async (req, res) => {
  const { name, email, category } = req.body;

  const organization = await Organization.findById(req.user.organization);
  if (category && !organization.categories.includes(category)) {
    throw new ApiError(
      400,
      `Invalid category. Valid categories for this organization: ${organization.categories.join(", ") || "(none defined yet)"}`
    );
  }

  const existingPerson = await Person.findOne({ email });

  if (existingPerson) {
    const existingMembership = await Membership.findOne({
      person: existingPerson._id,
      organization: req.user.organization,
    });
    if (existingMembership) {
      throw new ApiError(409, "This person is already a member (or has a pending invite) in this organization");
    }

    const membership = await Membership.create({
      person: existingPerson._id,
      organization: req.user.organization,
      role: "member",
      category: category || null,
      status: "pending",
    });

    await sendMemberInviteEmail(
      existingPerson.email,
      existingPerson.name,
      organization.name,
      `${env.CLIENT_URL}/login`
    );

    return res
      .status(201)
      .json(
        new ApiResponse(
          201,
          {
            user: {
              _id: existingPerson._id,
              name: existingPerson.name,
              email: existingPerson.email,
              category: membership.category,
              status: membership.status,
            },
          },
          "Invite sent — the member will appear once they accept it"
        )
      );
  }

  const person = await Person.create({ name, email }); // password stays null until they set one

  const rawToken = crypto.randomBytes(32).toString("hex");
  person.setPasswordToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  person.setPasswordExpires = new Date(Date.now() + SET_PASSWORD_TOKEN_EXPIRY_MS);
  await person.save({ validateBeforeSave: false });

  const membership = await Membership.create({
    person: person._id,
    organization: req.user.organization,
    role: "member",
    category: category || null,
    status: "active",
  });

  await sendSetPasswordEmail(
    email,
    name,
    `${env.CLIENT_URL}/set-password/${rawToken}`
  );

  res
    .status(201)
    .json(
      new ApiResponse(
        201,
        {
          user: {
            _id: person._id,
            name: person.name,
            email: person.email,
            category: membership.category,
            status: membership.status,
          },
        },
        "Member added successfully"
      )
    );
});

/**
 * Admin-only: lists every member (never other admins) in the admin's
 * own organization, for the Manage Members dashboard.
 */
const listMembers = asyncHandler(async (req, res) => {
  const memberships = await Membership.find({ organization: req.user.organization, role: "member" })
    .select("category status isEnrolled isActive isFlagged flagReason flaggedAt flaggedImageUrl")
    .populate("person", "name email")
    .sort({ isFlagged: -1, "person.name": 1 });

  const members = memberships
    .filter((m) => m.person) // guard against an orphaned Membership if a Person was ever removed elsewhere
    .map((m) => ({
      _id: m.person._id,
      name: m.person.name,
      email: m.person.email,
      category: m.category,
      status: m.status,
      isEnrolled: m.isEnrolled,
      isActive: m.isActive,
      isFlagged: m.isFlagged,
      flagReason: m.flagReason,
      flaggedAt: m.flaggedAt,
      flaggedImageUrl: m.flaggedImageUrl,
    }))
    .sort((a, b) => (b.isFlagged - a.isFlagged) || a.name.localeCompare(b.name));

  res.status(200).json(new ApiResponse(200, { members }, "Members fetched"));
});

/**
 * Admin-only: edits a member's name/email (on Person) or category (on
 * Membership). Scoped to the admin's own org and to role "member" so an
 * admin can never edit another org's people or another admin's account
 * through this route.
 */
const updateMember = asyncHandler(async (req, res) => {
  const { name, email, category } = req.body;

  const membership = await Membership.findOne({
    person: req.params.id,
    organization: req.user.organization,
    role: "member",
  });
  if (!membership) {
    throw new ApiError(404, "Member not found");
  }

  const person = await Person.findById(req.params.id);
  if (!person) {
    throw new ApiError(404, "Member not found");
  }

  if (email && email !== person.email) {
    const existing = await Person.findOne({ email });
    if (existing) {
      throw new ApiError(409, "A user with this email already exists");
    }
    person.email = email;
  }

  if (name) person.name = name;

  if (category) {
    const organization = await Organization.findById(req.user.organization);
    if (!organization.categories.includes(category)) {
      throw new ApiError(400, `Invalid category. Valid categories: ${organization.categories.join(", ")}`);
    }
    membership.category = category;
  }

  await person.save();
  await membership.save();

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { user: { _id: person._id, name: person.name, email: person.email, category: membership.category } },
        "Member updated"
      )
    );
});

/**
 * Admin-only: toggles a member's isActive flag on their Membership.
 * Deactivated members are blocked at login and mid-session (see
 * auth.service.js / auth.middleware.js) but their data (attendance
 * history, enrollment) is left intact — this is reversible, unlike
 * removeMember below.
 */
const setMemberActiveStatus = (isActive) =>
  asyncHandler(async (req, res) => {
    const membership = await Membership.findOneAndUpdate(
      { person: req.params.id, organization: req.user.organization, role: "member" },
      { isActive },
      { returnDocument: "after" }
    );
    if (!membership) {
      throw new ApiError(404, "Member not found");
    }

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { user: { _id: req.params.id, isActive: membership.isActive } },
          isActive ? "Member reactivated" : "Member deactivated"
        )
      );
  });

/**
 * Admin-only: permanently removes a member from THIS organization —
 * deletes their Membership and this org's FaceEmbedding. The Person
 * (global identity) is deliberately left alone: they may belong to other
 * orgs, and even if not, an orphaned Person with no Membership is
 * harmless (they simply can't log into anything). AttendanceRecords are
 * also kept (they already snapshot category/name/email at mark time) so
 * historical exports stay accurate even after the membership is gone.
 */
const removeMember = asyncHandler(async (req, res) => {
  const membership = await Membership.findOne({
    person: req.params.id,
    organization: req.user.organization,
    role: "member",
  });
  if (!membership) {
    throw new ApiError(404, "Member not found");
  }

  await FaceEmbedding.deleteOne({ person: membership.person, organization: membership.organization });
  await membership.deleteOne();

  res.status(200).json(new ApiResponse(200, {}, "Member removed"));
});

/**
 * Admin-only: clears a member's flag (on their Membership for this org)
 * after review. The flag on any individual AttendanceRecord that
 * triggered it is left as-is — it's a historical fact ("this record
 * scored X") — only the "needs review" flag is cleared here. Also cleans
 * up the review image, if one exists, since there's no reason to keep it
 * once reviewed.
 */
const unflagMember = asyncHandler(async (req, res) => {
  const membership = await Membership.findOne({
    person: req.params.id,
    organization: req.user.organization,
    role: "member",
  });
  if (!membership) {
    throw new ApiError(404, "Member not found");
  }

  if (membership.flaggedImagePublicId) {
    await deleteFlaggedImage(membership.flaggedImagePublicId).catch((err) =>
      console.error("Failed to delete flagged image on unflag:", err.message)
    );
  }

  membership.isFlagged = false;
  membership.flagReason = null;
  membership.flaggedAt = null;
  membership.flaggedImageUrl = null;
  membership.flaggedImagePublicId = null;
  await membership.save();

  res.status(200).json(new ApiResponse(200, { user: { _id: req.params.id } }, "Member unflagged"));
});

/**
 * Admin-only: deletes just the flagged-review image, independent of the
 * flag itself — the member can remain flagged with no image attached
 * (e.g. admin already looked at it and doesn't need to keep it on file).
 */
const deleteFlagImage = asyncHandler(async (req, res) => {
  const membership = await Membership.findOne({
    person: req.params.id,
    organization: req.user.organization,
    role: "member",
  });
  if (!membership) {
    throw new ApiError(404, "Member not found");
  }
  if (!membership.flaggedImagePublicId) {
    throw new ApiError(404, "No flagged image to delete");
  }

  await deleteFlaggedImage(membership.flaggedImagePublicId);
  membership.flaggedImageUrl = null;
  membership.flaggedImagePublicId = null;
  await membership.save();

  res.status(200).json(new ApiResponse(200, {}, "Flagged image deleted"));
});

export {
  enrollFace,
  getProfile,
  uploadMyAvatar,
  removeMyAvatar,
  listMyInvites,
  acceptInvite,
  addMember,
  listMembers,
  updateMember,
  setMemberActiveStatus,
  removeMember,
  unflagMember,
  deleteFlagImage,
};