import axios from "axios";

import { FaceEmbedding } from "../models/FaceEmbedding.model.js";
import { Membership } from "../models/Membership.model.js";
import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";

const MATCH_THRESHOLD = 0.4; // tau — cosine similarity must clear this to count as a match
const FLAG_THRESHOLD = 0.5; // matches between MATCH_THRESHOLD and this are accepted but flagged for admin review — a genuine match is usually well clear of tau, so a narrow pass is suspicious

/**
 * Sends a raw image buffer to the ML microservice's /embed endpoint and
 * returns the detected faces with their 512-d embeddings. Throws if the
 * ML service is unreachable or returns no face.
 */
const getEmbeddingsFromImage = async (imageBuffer, filename, mimetype) => {
  const formData = new FormData();
  formData.append("image", new Blob([imageBuffer], { type: mimetype }), filename);

  let response;
  try {
    response = await axios.post(`${env.ML_SERVICE_URL}/api/v1/embed`, formData);
  } catch (error) {
    throw new ApiError(502, "Face embedding service is unavailable", [error.message]);
  }

  const { face_count, faces } = response.data;
  if (!face_count || faces.length === 0) {
    throw new ApiError(422, "No face detected in the image");
  }

  return faces;
};

/**
 * Standard cosine similarity between two equal-length vectors.
 * Both vectors coming from the ML service are already L2-normalized, so
 * this reduces to a plain dot product — kept general here regardless.
 */
const cosineSimilarity = (a, b) => {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * Compares a freshly generated embedding against every enrolled
 * FaceEmbedding in the same organization, returning the closest match
 * if — and only if — it clears MATCH_THRESHOLD.
 *
 * category now lives on Membership (not on Person), so it's fetched in a
 * second lookup once we know which person matched. That lookup also acts
 * as a defensive guard: a "pending" invite's Membership shouldn't have a
 * FaceEmbedding for this org yet anyway (nothing copies one until they
 * accept), but requiring an ACTIVE Membership here means a match can
 * never be recorded against someone who hasn't accepted, even if some
 * future code path ever created an embedding early.
 */
const findBestMatch = async (embedding, organizationId) => {
  const enrolled = await FaceEmbedding.find({ organization: organizationId }).populate(
    "person",
    "name email"
  );

  let bestMatch = null;
  let bestScore = -1;

  for (const record of enrolled) {
    const score = cosineSimilarity(embedding, record.embedding);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = record;
    }
  }

  if (!bestMatch || bestScore < MATCH_THRESHOLD) {
    return { matched: false, score: bestScore };
  }

  const membership = await Membership.findOne({
    person: bestMatch.person._id,
    organization: organizationId,
    status: "active",
  }).select("category");

  if (!membership) {
    // No active membership for this org (shouldn't happen — fail closed).
    return { matched: false, score: bestScore };
  }

  return {
    matched: true,
    score: bestScore,
    person: bestMatch.person,
    category: membership.category,
    flagged: bestScore < FLAG_THRESHOLD,
  };
};

export { getEmbeddingsFromImage, cosineSimilarity, findBestMatch, MATCH_THRESHOLD, FLAG_THRESHOLD };