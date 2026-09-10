import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { requireAdmin } from "../middlewares/role.middleware.js";
import { getOrganizationAnalyticsHandler, getMemberAnalyticsHandler, getAnalyticsSummary } from "../controllers/analytics.controller.js";

const router = Router();

router.use(verifyJWT);
router.get("/organization", requireAdmin, getOrganizationAnalyticsHandler);
router.get("/me", getMemberAnalyticsHandler);
router.get("/organization/summary", requireAdmin, getAnalyticsSummary);

export default router;