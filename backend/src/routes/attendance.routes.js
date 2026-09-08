import { Router } from "express";
import multer from "multer";

import {
  markAttendance,
  getMyAttendance,
  getOrganizationAttendance,
  exportOrganizationAttendance,
} from "../controllers/attendance.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { requireAdmin } from "../middlewares/role.middleware.js";

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

router.use(verifyJWT); // every route below requires a logged-in user

router.post("/mark", requireAdmin, upload.single("image"), markAttendance);
router.get("/me", getMyAttendance);
router.get("/organization", requireAdmin, getOrganizationAttendance);
router.get("/organization/export", requireAdmin, exportOrganizationAttendance);

export default router;