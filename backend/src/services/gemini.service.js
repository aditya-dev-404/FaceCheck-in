import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";

const GEMINI_API_KEY = env.GEMINI_API_KEY;
const GEMINI_MODEL = env.GEMINI_MODEL || "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const SECTION_KEYS = ["overview", "attendanceTrend", "categoryBreakdown", "flaggedMatches", "lateEntries", "performers"];

/**
 * Generates a detailed, per-section plain-English summary of the org's attendance analytics.
 * Each section is a paragraph (3-5 sentences) meant for its own expandable card.
 * @param {object} analyticsData - the same aggregated JSON analytics.service.js already produces
 * @returns {Promise<{overview:string, attendanceTrend:string, categoryBreakdown:string, flaggedMatches:string, performers:string}>}
 */
async function generateAnalyticsSections(analyticsData) {
  if (!GEMINI_API_KEY) {
    throw new ApiError(500, "GEMINI_API_KEY is not configured");
  }

  const prompt = `You are an assistant summarizing attendance analytics for a college/organization admin.
Given the following JSON analytics data, write a detailed summary broken into exactly these sections:

- overview: 3-5 sentences on overall attendance health (total members, avg attendance rate, today's check-ins, flags this month).
- attendanceTrend: 3-5 sentences describing how the daily attendance rate moved over the selected date range (improving, declining, stable, notable spikes/dips).
- categoryBreakdown: 3-5 sentences comparing attendance rates across categories, calling out the strongest and weakest.
- flaggedMatches: 3-5 sentences on the flagged/low-confidence match rate over the period and whether it's a concern.
- lateEntries: 3-5 sentences on the late-entry rate (lateStats, lateTrend, lateByCategory) — how often members check in late, average lateness, and which categories run later than others.
- performers: 3-5 sentences highlighting top performers and members who need attention (from bottomPerformers), phrased constructively.

Respond ONLY with a raw JSON object with exactly these keys: overview, attendanceTrend, categoryBreakdown, flaggedMatches, lateEntries, performers.
No markdown, no code fences, no extra keys, no preamble.

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
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new ApiError(502, "Gemini API returned no summary text");
  }

  const cleaned = rawText.replace(/```json|```/g, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new ApiError(502, "Gemini API returned malformed JSON for analytics sections");
  }

  const sections = {};
  for (const key of SECTION_KEYS) {
    if (typeof parsed[key] !== "string" || !parsed[key].trim()) {
      throw new ApiError(502, `Gemini API response missing section: ${key}`);
    }
    sections[key] = parsed[key].trim();
  }

  return sections;
}

export { generateAnalyticsSections };