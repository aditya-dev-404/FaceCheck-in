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

// Member-management handlers below are all scoped by (person id from
// req.params.id) + (req.user.organization) + role:"member", so an admin
// can never touch another org's people or another admin's Membership.
// req.params.id is a Person._id.
//
// A person has ONE active Membership at a time. Leaving, being removed, or
// joining another organization turns the old one into a "past" Membership
// (kept on record) instead of deleting it.

const SET_PASSWORD_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours — a one-time welcome link, so longer than the reset-password window

/**
 * Enrollment flow: capture -> detect -> align -> embed -> store.
 * The embedding is stored against the logged-in person's active organization.
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

/**
 * Works for a person with no active organization too (organization is
 * then null) so the frontend can show the "no organization" screen.
 */
const getProfile = asyncHandler(async (req, res) => {
  const person = await Person.findById(req.user._id).select("-password -refreshToken");

  const membership = req.membership
    ? await Membership.findById(req.membership._id).populate("organization", "name logoUrl")
    : null;

  const profile = {
    _id: person._id,
    name: person.name,
    email: person.email,
    avatarUrl: person.avatarUrl,
    role: membership?.role ?? null,
    category: membership?.category ?? null,
    isEnrolled: membership?.isEnrolled ?? false,
    organization: membership?.organization ?? null,
  };

  res.status(200).json(new ApiResponse(200, { user: profile }, "Profile fetched"));
});

/**
 * Self-service: any logged-in person can set their own avatar — a display
 * picture only, never used for face recognition. Lives on Person since it
 * isn't tied to one organization.
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
 * Self-service: lists this person's pending invites (Memberships with
 * status "pending") from any organization.
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
 * Self-service: accepts a pending invite. Because a person can only have
 * one active organization, accepting ends their current membership (it
 * becomes "past") and makes the invited one active. Their face enrollment
 * is carried over, so they don't have to re-enroll.
 *
 * Organization admins can't accept — moving an admin out would leave their
 * organization without an admin.
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

  const current = await Membership.findOne({
    person: req.user._id,
    status: "active",
    _id: { $ne: membership._id },
  });
  if (current?.role === "admin") {
    throw new ApiError(409, "You are an admin of another organization and can't join a different one");
  }

  // Grab the existing embedding before the current membership is wound down.
  const existingEmbedding = await FaceEmbedding.findOne({ person: req.user._id }).sort({ updatedAt: -1 });

  if (current) {
    await FaceEmbedding.deleteOne({ person: req.user._id, organization: current.organization });
    current.status = "past";
    current.leftAt = new Date();
    current.leftReason = "switched";
    current.isEnrolled = false;
    await current.save();
  }

  if (existingEmbedding) {
    await FaceEmbedding.findOneAndUpdate(
      { person: req.user._id, organization: membership.organization },
      { person: req.user._id, organization: membership.organization, embedding: existingEmbedding.embedding },
      { upsert: true }
    );
    membership.isEnrolled = true;
  }

  membership.status = "active";
  membership.leftAt = null;
  membership.leftReason = null;
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
 * Self-service: a member leaves their current organization. The membership
 * becomes "past" (the organization keeps it in its Removed Members list)
 * and this organization's face data is deleted. Only an admin can add them
 * back. Admins can't leave — that would orphan the organization.
 */
const leaveOrganization = asyncHandler(async (req, res) => {
  const membership = req.membership;

  if (membership.role !== "member") {
    throw new ApiError(400, "Organization admins can't leave their organization");
  }

  await FaceEmbedding.deleteOne({ person: membership.person, organization: membership.organization });

  membership.status = "past";
  membership.leftAt = new Date();
  membership.leftReason = "left";
  membership.isEnrolled = false;
  await membership.save();

  res.status(200).json(new ApiResponse(200, {}, "You have left the organization"));
});

/**
 * Admin-only: adds a member to the admin's own organization.
 *
 * Branches on whether a Person with this email already exists:
 *  - NEW email -> create Person with no password + active Membership, and
 *    email a one-time "set your password" link.
 *  - EXISTING email -> INVITE flow: a "pending" Membership is created (or,
 *    for someone who used to belong to this organization, their past
 *    Membership is reused and set back to "pending") and an invite email
 *    is sent. It only takes effect once the person accepts it.
 */
const addMember = asyncHandler(async (req, res) => {
  const { name, email, category, checkInTime, gracePeriodMinutes } = req.body;

  if (checkInTime !== undefined && checkInTime !== null && checkInTime !== "") {
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(checkInTime)) {
      throw new ApiError(400, "checkInTime must be in HH:mm 24-hour format");
    }
  }
  if (gracePeriodMinutes !== undefined) {
    const grace = Number(gracePeriodMinutes);
    if (Number.isNaN(grace) || grace < 0) {
      throw new ApiError(400, "gracePeriodMinutes must be a non-negative number");
    }
  }

  const organization = await Organization.findById(req.user.organization);
  if (category && !organization.categories.includes(category)) {
    throw new ApiError(
      400,
      `Invalid category. Valid categories for this organization: ${organization.categories.join(", ") || "(none defined yet)"}`
    );
  }

  const existingPerson = await Person.findOne({ email });

  if (existingPerson) {
    // An admin of another organization can't join a different one (it would
    // leave that organization without an admin), so don't send an invite
    // that could never be accepted.
    const adminElsewhere = await Membership.exists({
      person: existingPerson._id,
      role: "admin",
      status: "active",
      organization: { $ne: req.user.organization },
    });
    if (adminElsewhere) {
      throw new ApiError(409, "This person administers another organization and can't be added as a member");
    }

    const existingMembership = await Membership.findOne({
      person: existingPerson._id,
      organization: req.user.organization,
    });

    let membership;

    if (existingMembership) {
      if (existingMembership.status !== "past") {
        throw new ApiError(409, "This person is already a member (or has a pending invite) in this organization");
      }

      // Adding back a past member: reuse their record (one record per
      // person per organization) and start a fresh invite.
      if (existingMembership.flaggedImagePublicId) {
        await deleteFlaggedImage(existingMembership.flaggedImagePublicId).catch((err) =>
          console.error("Failed to delete old flagged image on re-add:", err.message)
        );
      }

      existingMembership.status = "pending";
      existingMembership.leftAt = null;
      existingMembership.leftReason = null;
      existingMembership.isEnrolled = false;
      existingMembership.isFlagged = false;
      existingMembership.flagReason = null;
      existingMembership.flaggedAt = null;
      existingMembership.flaggedImageUrl = null;
      existingMembership.flaggedImagePublicId = null;
      if (category) existingMembership.category = category;
      if (checkInTime) existingMembership.checkInTime = checkInTime;
      if (gracePeriodMinutes !== undefined) existingMembership.gracePeriodMinutes = Number(gracePeriodMinutes);
      await existingMembership.save();

      membership = existingMembership;
    } else {
      membership = await Membership.create({
        person: existingPerson._id,
        organization: req.user.organization,
        role: "member",
        category: category || null,
        status: "pending",
        checkInTime: checkInTime || null,
        gracePeriodMinutes: gracePeriodMinutes !== undefined ? Number(gracePeriodMinutes) : 10,
      });
    }

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
    checkInTime: checkInTime || null,
    gracePeriodMinutes: gracePeriodMinutes !== undefined ? Number(gracePeriodMinutes) : 10,
  });

  await sendSetPasswordEmail(email, name, `${env.CLIENT_URL}/set-password/${rawToken}`);

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
 * Admin-only: lists the current members of the admin's organization
 * (active + pending invites; never admins or past members).
 */
const listMembers = asyncHandler(async (req, res) => {
  const memberships = await Membership.find({
    organization: req.user.organization,
    role: "member",
    status: { $ne: "past" },
  })
    .select("category status isEnrolled isActive isFlagged flagReason flaggedAt flaggedImageUrl checkInTime gracePeriodMinutes")
    .populate("person", "name email");

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
      checkInTime: m.checkInTime,
      gracePeriodMinutes: m.gracePeriodMinutes,
    }))
    .sort((a, b) => (b.isFlagged - a.isFlagged) || a.name.localeCompare(b.name));

  res.status(200).json(new ApiResponse(200, { members }, "Members fetched"));
});

/**
 * Admin-only: lists people who used to belong to the admin's organization
 * (removed by an admin, left on their own, or moved to another
 * organization), most recent first.
 */
const listRemovedMembers = asyncHandler(async (req, res) => {
  const memberships = await Membership.find({
    organization: req.user.organization,
    role: "member",
    status: "past",
  })
    .select("category leftAt leftReason")
    .populate("person", "name email")
    .sort({ leftAt: -1 });

  const members = memberships
    .filter((m) => m.person)
    .map((m) => ({
      _id: m.person._id,
      name: m.person.name,
      email: m.person.email,
      category: m.category,
      leftAt: m.leftAt,
      leftReason: m.leftReason,
    }));

  res.status(200).json(new ApiResponse(200, { members }, "Removed members fetched"));
});

/**
 * Admin-only: edits a member's name/email (on Person), category (on
 * Membership), or their late-entry check-in time / grace period (on
 * Membership). Scoped to the admin's own org and to role "member".
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

  if (req.body.checkInTime !== undefined) {
    if (req.body.checkInTime !== null && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(req.body.checkInTime)) {
      throw new ApiError(400, "checkInTime must be in HH:mm 24-hour format");
    }
    membership.checkInTime = req.body.checkInTime;
  }

  if (req.body.gracePeriodMinutes !== undefined) {
    const grace = Number(req.body.gracePeriodMinutes);
    if (Number.isNaN(grace) || grace < 0) {
      throw new ApiError(400, "gracePeriodMinutes must be a non-negative number");
    }
    membership.gracePeriodMinutes = grace;
  }

  await person.save();
  await membership.save();

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {
          user: {
            _id: person._id,
            name: person.name,
            email: person.email,
            category: membership.category,
            checkInTime: membership.checkInTime,
            gracePeriodMinutes: membership.gracePeriodMinutes,
          },
        },
        "Member updated"
      )
    );
});

/**
 * Admin-only: toggles a member's isActive flag on their Membership.
 * Deactivated members are blocked at login and mid-session but their data
 * is left intact — reversible, unlike removeMember below.
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
 * Admin-only: removes a member from THIS organization — always a soft
 * delete. The membership becomes "past" (a cancelled pending invite too,
 * with leftReason "invite_cancelled"); the record, attendance history and
 * Person account are all kept. Only this organization's face data is
 * deleted. The admin can add them back later from Removed Members.
 */
const removeMember = asyncHandler(async (req, res) => {
  const membership = await Membership.findOne({
    person: req.params.id,
    organization: req.user.organization,
    role: "member",
    status: { $ne: "past" },
  });
  if (!membership) {
    throw new ApiError(404, "Member not found");
  }

  // Nothing is ever hard-deleted: a cancelled invite is kept as a past
  // membership too, so it also appears in Removed members.
  const wasPending = membership.status === "pending";

  await FaceEmbedding.deleteOne({ person: membership.person, organization: membership.organization });

  membership.status = "past";
  membership.leftAt = new Date();
  membership.leftReason = wasPending ? "invite_cancelled" : "removed";
  membership.isEnrolled = false;
  await membership.save();

  res.status(200).json(new ApiResponse(200, {}, wasPending ? "Invite cancelled" : "Member removed"));
});

/**
 * Admin-only: clears a member's flag after review. The flag on any
 * individual AttendanceRecord is left as-is — it's a historical fact.
 * Also deletes the review image, since there's no reason to keep it.
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
 * flag itself — the member can remain flagged with no image attached.
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
  leaveOrganization,
  addMember,
  listMembers,
  listRemovedMembers,
  updateMember,
  setMemberActiveStatus,
  removeMember,
  unflagMember,
  deleteFlagImage,
};