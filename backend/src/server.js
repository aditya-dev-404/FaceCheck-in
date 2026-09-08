/**
 * Entrypoint: connect to MongoDB, then start the HTTP server.
 * Keeping this separate from app.js means the DB connection only happens
 * when we actually intend to run the server (not when importing app for tests).
 */
import { app } from "./app.js";
import { connectDB } from "./config/db.js";
import { env } from "./config/env.js";

connectDB()
  .then(() => {
    app.listen(env.PORT, () => {
      console.log(`FaceCheck-in backend running on port ${env.PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });