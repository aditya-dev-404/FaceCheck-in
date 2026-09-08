import { Router } from "express";
import multer from "multer";

import { recognize, getInfo } from "../controllers/kiosk.controller.js";
import { verifyKioskSecret } from "../middlewares/kiosk.middleware.js";

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

router.get("/info", verifyKioskSecret, getInfo);
router.post("/recognize", verifyKioskSecret, upload.single("image"), recognize);

export default router;