import axiosInstance from "./axiosInstance";

export const getOrganizationAnalytics = (params) =>
  axiosInstance.get("/analytics/organization", { params }).then((res) => res.data.data);

export const getMemberAnalytics = (params) =>
  axiosInstance.get("/analytics/me", { params }).then((res) => res.data.data);