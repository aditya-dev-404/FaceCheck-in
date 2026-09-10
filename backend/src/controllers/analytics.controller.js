import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { getOrganizationAnalytics, getMemberAnalytics } from "../services/analytics.service.js";
import { generateAnalyticsSummary } from "../services/gemini.service.js";

export const getOrganizationAnalyticsHandler = asyncHandler(async (req, res) => {
  const data = await getOrganizationAnalytics(req.user.organization, req.query);
  res.status(200).json(new ApiResponse(200, data, "Organization analytics fetched"));
});

export const getMemberAnalyticsHandler = asyncHandler(async (req, res) => {
  const data = await getMemberAnalytics(req.user._id, req.user.organization, req.query);
  res.status(200).json(new ApiResponse(200, data, "Member analytics fetched"));
});


export const getAnalyticsSummary = asyncHandler(async (req, res) => {
  const analyticsData = await getOrganizationAnalytics(req.user.organization, req.query);
  const summary = await generateAnalyticsSummary(analyticsData);
  res.status(200).json(new ApiResponse(200, { summary }, "Summary generated"));
});