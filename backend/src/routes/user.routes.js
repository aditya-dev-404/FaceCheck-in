import { Router } from "express";
import multer from "multer";

import {
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
} from "../controllers/user.controller.js";
import {
  getMemberDetails,
  getMemberStats,
  getMemberAttendance,
  exportMemberAttendance,
} from "../controllers/memberDetail.controller.js";
import { verifyJWT, verifyPerson } from "../middlewares/auth.middleware.js";
import { requireAdmin } from "../middlewares/role.middleware.js";
import { imageUpload } from "../middlewares/imageUpload.middleware.js";

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

// Routes a logged-in person can use even with no active organization
// (they left, were removed, or are waiting on an invite).
router.get("/me", verifyPerson, getProfile);
router.post("/me/avatar", verifyPerson, imageUpload.single("avatar"), uploadMyAvatar);
router.delete("/me/avatar", verifyPerson, removeMyAvatar);
router.get("/me/invites", verifyPerson, listMyInvites);
router.patch("/me/invites/:membershipId/accept", verifyPerson, acceptInvite);

// Everything below requires an active organization.
router.use(verifyJWT);

router.post("/enroll", upload.single("image"), enrollFace);
router.post("/me/leave", leaveOrganization);

// Admin-only member management
router.get("/", requireAdmin, listMembers);
router.post("/", requireAdmin, addMember);
router.get("/removed", requireAdmin, listRemovedMembers);

// Admin-only member detail view (profile, stats, attendance records, CSV)
router.get("/:id/details", requireAdmin, getMemberDetails);
router.get("/:id/analytics", requireAdmin, getMemberStats);
router.get("/:id/attendance", requireAdmin, getMemberAttendance);
router.get("/:id/attendance/export", requireAdmin, exportMemberAttendance);

router.patch("/:id", requireAdmin, updateMember);
router.patch("/:id/deactivate", requireAdmin, setMemberActiveStatus(false));
router.patch("/:id/activate", requireAdmin, setMemberActiveStatus(true));
router.patch("/:id/unflag", requireAdmin, unflagMember);
router.delete("/:id/flag-image", requireAdmin, deleteFlagImage);
router.delete("/:id", requireAdmin, removeMember);

export default router;