/**
 * Express app configuration: middleware + route mounting.
 * Kept separate from server.js so the app object can be imported directly
 * in tests without actually starting a listener.
 */
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import { errorHandler } from "./middlewares/errorHandler.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import attendanceRoutes from "./routes/attendance.routes.js";
import organizationRoutes from "./routes/organization.routes.js";
import kioskRoutes from "./routes/kiosk.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" })); // base64 image payloads can be sizable
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/attendance", attendanceRoutes);
app.use("/api/v1/organizations", organizationRoutes);
app.use("/api/v1/kiosk", kioskRoutes);
app.use("/api/v1/analytics", analyticsRoutes);

// Must be registered last: catches errors thrown/forwarded from any route.
app.use(errorHandler);

export { app };