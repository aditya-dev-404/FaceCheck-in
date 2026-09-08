/**
 * Global error handler — must be registered last in app.js. Catches every
 * error thrown or passed to next() anywhere in the app: ApiError instances
 * thrown deliberately in services/controllers, plus anything unexpected
 * (Mongoose errors, JSON parse errors, etc.) that would otherwise crash
 * the process or leak a raw stack trace to the client.
 */
import { ApiError } from "../utils/ApiError.js";

const errorHandler = (err, req, res, next) => {
  let error = err;

  // Normalize anything that isn't already an ApiError into one, so the
  // response shape is always consistent.
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const message = error.message || "Internal server error";
    error = new ApiError(statusCode, message, error.errors || [], err.stack);
  }

  const response = {
    success: false,
    statusCode: error.statusCode,
    message: error.message,
    errors: error.errors,
    ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
  };

  return res.status(error.statusCode).json(response);
};

export { errorHandler };