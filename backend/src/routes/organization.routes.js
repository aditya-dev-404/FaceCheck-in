import { Router } from "express";

import {
  getMyOrganization,
  updateMyOrganization,
  generateKioskCredentials,
  uploadLogo,
  removeLogo,
} from "../controllers/organization.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { requireAdmin } from "../middlewares/role.middleware.js";
import { imageUpload } from "../middlewares/imageUpload.middleware.js";

const router = Router();

router.use(verifyJWT, requireAdmin); // every route here is admin-only

router.get("/me", getMyOrganization);
router.patch("/me", updateMyOrganization);
router.post("/me/kiosk-credentials", generateKioskCredentials);
router.post("/me/logo", imageUpload.single("logo"), uploadLogo);
router.delete("/me/logo", removeLogo);

export default router;