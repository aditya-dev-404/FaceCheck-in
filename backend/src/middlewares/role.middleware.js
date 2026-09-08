import { ApiError } from "../utils/ApiError.js";

const requireAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return next(new ApiError(403, "Admin access required"));
  }
  next();
};

export { requireAdmin };