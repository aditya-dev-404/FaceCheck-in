import { v2 as cloudinary } from "cloudinary";

import { env } from "../config/env.js";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

const BASE_FOLDER = "faceCheck-in"; // namespaced since this Cloudinary account holds other, unrelated projects too

/**
 * Generic upload helper — takes a raw image buffer (any mimetype Cloudinary
 * can decode) and uploads it under faceCheck-in/<folder>/. Returns the
 * secure URL (for display) and the public_id (needed to delete it later).
 */
const uploadImage = async (buffer, folder, publicId) => {
  const base64 = `data:image/jpeg;base64,${buffer.toString("base64")}`;

  const result = await cloudinary.uploader.upload(base64, {
    folder: `${BASE_FOLDER}/${folder}`,
    public_id: publicId,
    overwrite: true,
  });

  return { url: result.secure_url, publicId: result.public_id };
};

const deleteImage = async (publicId) => {
  if (!publicId) return;
  await cloudinary.uploader.destroy(publicId);
};

const uploadFlaggedImage = (buffer, userId) =>
  uploadImage(buffer, "flagged-review", `flag-${userId}-${Date.now()}`);

const uploadOrgLogo = (buffer, organizationId) => uploadImage(buffer, "org-logos", `logo-${organizationId}`);

const uploadAvatar = (buffer, userId) => uploadImage(buffer, "avatars", `avatar-${userId}`);

export { uploadImage, deleteImage, uploadFlaggedImage, uploadOrgLogo, uploadAvatar };
export { deleteImage as deleteFlaggedImage }; // kept as an alias — existing call sites use this name for the same operation