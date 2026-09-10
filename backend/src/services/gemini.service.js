import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";

const GEMINI_API_KEY = env.GEMINI_API_KEY;
const GEMINI_MODEL = env.GEMINI_MODEL || "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

/**
 * Generates a plain-English 3-4 sentence summary of the org's attendance analytics.
 * @param {object} analyticsData - the same aggregated JSON analytics.service.js already produces
 * @returns {Promise<string>} summary text
 */
async function generateAnalyticsSummary(analyticsData) {
  if (!GEMINI_API_KEY) {
    throw new ApiError(500, "GEMINI_API_KEY is not configured");
  }

  const prompt = `You are an assistant summarizing attendance analytics for a college/organization admin.
Given the following JSON analytics data, write a plain-English summary in exactly 3-4 sentences.
Mention overall attendance trend, any notable category differences, and flag anything that stands out
(e.g. a category or trend that needs attention). Do not repeat raw numbers excessively — describe the picture.

Analytics data:
${JSON.stringify(analyticsData)}`;

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new ApiError(502, `Gemini API request failed: ${errText}`);
  }

  const data = await response.json();
  const summary = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!summary) {
    throw new ApiError(502, "Gemini API returned no summary text");
  }

  return summary.trim();
}

export { generateAnalyticsSummary };