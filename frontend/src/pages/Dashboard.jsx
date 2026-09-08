/**
 * Landing page after login. Members see their own attendance history and
 * links to enroll/mark attendance; admins additionally see the full
 * organization's attendance log, a category filter, and a CSV export.
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axiosInstance from "../api/axiosInstance";
import useAuth from "../hooks/useAuth";
import { MdDownload, MdGroup, MdHowToReg, MdPersonAdd, MdSettings, MdVerifiedUser } from "react-icons/md";

const Dashboard = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!user) return; // guards against a null user during a brief refresh window, which previously crashed this effect and left a blank screen until reload

    const fetchRecords = async () => {
      try {
        const endpoint = user.role === "admin" ? "/attendance/organization" : "/attendance/me";
        const params = user.role === "admin" && categoryFilter ? { category: categoryFilter } : {};
        const { data } = await axiosInstance.get(endpoint, { params });
        setRecords(data.data.records);
      } catch {
        setRecords([]);
      } finally {
        setLoading(false);
      }
    };
    fetchRecords();
  }, [user, categoryFilter]);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    const fetchCategories = async () => {
      try {
        const { data } = await axiosInstance.get("/organizations/me");
        setCategories(data.data.organization.categories || []);
      } catch {
        setCategories([]);
      }
    };
    fetchCategories();
  }, [user]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = categoryFilter ? { category: categoryFilter } : {};
      const response = await axiosInstance.get("/attendance/organization/export", {
        params,
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `attendance${categoryFilter ? `-${categoryFilter}` : ""}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="clay-page">
      <div className="clay-page-header"><div><p className="text-sm font-medium text-primary">{user?.role === "admin" ? "Organization overview" : "Your attendance"}</p><h1 className="mt-1 text-2xl font-semibold text-text">Welcome back, {user?.name}</h1></div><div className="flex h-12 w-12 items-center justify-center rounded-clay-sm bg-surface-raised text-primary shadow-clay-inset"><MdVerifiedUser aria-hidden="true" className="text-2xl" /></div></div>

      <nav className="clay-card flex flex-wrap gap-3 p-4">
        {!user?.isEnrolled && (
          <Link
            to="/enroll"
            className="clay-btn-primary"
          >
            <MdPersonAdd aria-hidden="true" /> Enroll your face
          </Link>
        )}
        {user?.role === "admin" ? (
          <Link
            to="/attendance"
            className="clay-btn-primary"
          >
            <MdHowToReg aria-hidden="true" /> Mark attendance
          </Link>
        ) : (
          <span className="clay-notice">
            Attendance is marked automatically at your organization's kiosk
          </span>
        )}
        {user?.role === "admin" && (
          <>
            <Link
              to="/manage-members"
              className="clay-action"
            >
              <MdGroup aria-hidden="true" /> Manage members
            </Link>
            <Link
              to="/manage-organization"
              className="clay-action"
            >
              <MdSettings aria-hidden="true" /> Organization
            </Link>
          </>
        )}
      </nav>

      <div className="clay-card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-text">
            {user?.role === "admin" ? "Organization Attendance" : "Your Attendance History"}
          </h2>
          {user?.role === "admin" && (
            <div className="flex items-center gap-2">
              {categories.length > 0 && (
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="clay-select w-auto py-1"
                >
                  <option value="">All categories</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting}
                className="clay-btn-primary px-3 py-1.5"
              >
                <MdDownload aria-hidden="true" /> {exporting ? "Exporting..." : "Download CSV"}
              </button>
            </div>
          )}
        </div>
        {loading ? (
          <p className="text-sm text-text-muted">Loading...</p>
        ) : records.length === 0 ? (
          <p className="clay-notice">No attendance records yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {records.map((record) => (
              <li key={record._id} className="flex items-center justify-between gap-3 py-3 text-sm text-text-muted">
                <span>
                  {user?.role === "admin" && (
                    <span className="font-medium text-text">{record.user?.name || record.memberName} — </span>
                  )}
                  {new Date(record.markedAt).toLocaleString()}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    record.markedVia === "admin" ? "bg-surface-raised text-warning" : "bg-surface-raised text-primary"
                  }`}
                >
                  {record.markedVia === "admin" ? "Admin Entry" : "Kiosk"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
