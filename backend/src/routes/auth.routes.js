import { Router } from "express";
import {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  setInitialPassword,
  listMyOrganizations,
  switchOrganization,
} from "../controllers/auth.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", verifyJWT, logout);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/set-password", setInitialPassword);

// Org switching — for people with 2+ active memberships
router.get("/organizations", verifyJWT, listMyOrganizations);
router.post("/switch-organization", verifyJWT, switchOrganization);

export default router;