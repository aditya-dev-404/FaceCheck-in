import multer from "multer";

import { ApiError } from "../utils/ApiError.js";

/**
 * For arbitrary user-supplied images (org logos, avatars) — as opposed to
 * face captures, which always come from our own canvas code and don't
 * need this validation. Rejects non-image files and anything over 5MB.
 */
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new ApiError(400, "Only image files are allowed"));
    }
    cb(null, true);
  },
});

export { imageUpload };