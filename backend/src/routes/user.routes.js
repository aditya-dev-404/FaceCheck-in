import { Router } from "express";
import multer from "multer";

import {
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
} from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { requireAdmin } from "../middlewares/role.middleware.js";
import { imageUpload } from "../middlewares/imageUpload.middleware.js";

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

router.use(verifyJWT); // every route below requires a logged-in user

router.get("/me", getProfile);
router.post("/enroll", upload.single("image"), enrollFace);
router.post("/me/avatar", imageUpload.single("avatar"), uploadMyAvatar);
router.delete("/me/avatar", removeMyAvatar);

// Admin-only member management
router.get("/", requireAdmin, listMembers);
router.post("/", requireAdmin, addMember);
router.patch("/:id", requireAdmin, updateMember);
router.patch("/:id/deactivate", requireAdmin, setMemberActiveStatus(false));
router.patch("/:id/activate", requireAdmin, setMemberActiveStatus(true));
router.patch("/:id/unflag", requireAdmin, unflagMember);
router.delete("/:id/flag-image", requireAdmin, deleteFlagImage);
router.delete("/:id", requireAdmin, removeMember);

export default router;