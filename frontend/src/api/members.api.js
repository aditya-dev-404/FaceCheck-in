import axiosInstance from "./axiosInstance";

export const getMemberDetails = (id) =>
  axiosInstance.get(`/users/${id}/details`).then((res) => res.data.data.member);

export const getMemberStats = (id, params) =>
  axiosInstance.get(`/users/${id}/analytics`, { params }).then((res) => res.data.data);

export const getMemberRecords = (id, params) =>
  axiosInstance.get(`/users/${id}/attendance`, { params }).then((res) => res.data.data);

export const downloadMemberCsv = async (id, params) => {
  const res = await axiosInstance.get(`/users/${id}/attendance/export`, { params, responseType: "blob" });
  const disposition = res.headers["content-disposition"] || "";
  const match = disposition.match(/filename="(.+)"/);
  const url = URL.createObjectURL(res.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = match ? match[1] : "member-attendance.csv";
  link.click();
  URL.revokeObjectURL(url);
};