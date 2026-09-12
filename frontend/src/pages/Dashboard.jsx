/**
 * Landing page after login. Members see their own attendance history and
 * links to enroll/mark attendance; admins additionally see the full
 * organization's attendance log, a category filter, and a CSV export.
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axiosInstance from "../api/axiosInstance";
import useAuth from "../hooks/useAuth";
import { MdDownload, MdGroup, MdHowToReg, MdPersonAdd, MdSettings, MdChevronLeft, MdChevronRight, MdVerifiedUser, MdInsertChartOutlined, MdListAlt, MdMailOutline } from "react-icons/md";
import AdminAnalytics from "../components/analytics/AdminAnalytics";
import MemberAnalytics from "../components/analytics/MemberAnalytics";


const Dashboard = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [exporting, setExporting] = useState(false);
  const [tab, setTab] = useState("attendance"); // "attendance" | "analytics"
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const PAGE_SIZE = 20;

  // Pending invites — orgs (possibly not the one currently logged into)
  // that have added this person and are waiting on acceptance.
  const [invites, setInvites] = useState([]);
  const [invitesLoading, setInvitesLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState(null);
  const [inviteError, setInviteError] = useState("");

  useEffect(() => {
    if (!user) return;

    const fetchInvites = async () => {
      setInvitesLoading(true);
      try {
        const { data } = await axiosInstance.get("/users/me/invites");
        setInvites(data.data.invites);
      } catch {
        setInvites([]);
      } finally {
        setInvitesLoading(false);
      }
    };
    fetchInvites();
  }, [user]);

  const handleAcceptInvite = async (membershipId) => {
    setAcceptingId(membershipId);
    setInviteError("");
    try {
      await axiosInstance.patch(`/users/me/invites/${membershipId}/accept`);
      setInvites((prev) => prev.filter((invite) => invite.membershipId !== membershipId));
    } catch (err) {
      setInviteError(err.response?.data?.message || "Could not accept invite");
    } finally {
      setAcceptingId(null);
    }
  };

  useEffect(() => {
    if (!user) return;

    const fetchRecords = async () => {
      setLoading(true);
      try {
        const endpoint = user.role === "admin" ? "/attendance/organization" : "/attendance/me";
        const params = {
          page,
          limit: PAGE_SIZE,
          ...(user.role === "admin" && categoryFilter ? { category: categoryFilter } : {}),
        };
        const { data } = await axiosInstance.get(endpoint, { params });
        setRecords(data.data.records);
        setTotalPages(data.data.totalPages || 1);
      } catch {
        setRecords([]);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    };
    fetchRecords();
  }, [user, categoryFilter, page]);


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

      {!invitesLoading && invites.length > 0 && (
        <div className="clay-card space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-text">
            <MdMailOutline aria-hidden="true" className="text-lg text-primary" />
            {invites.length === 1 ? "You've been invited to join an organization" : `You've been invited to join ${invites.length} organizations`}
          </h2>
          {inviteError && <p className="text-sm text-danger">{inviteError}</p>}
          <ul className="space-y-2">
            {invites.map((invite) => (
              <li
                key={invite.membershipId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-clay-sm bg-surface-raised px-4 py-3 shadow-clay-sm"
              >
                <div className="flex items-center gap-3">
                  {invite.organization?.logoUrl ? (
                    <img src={invite.organization.logoUrl} alt="" className="h-8 w-8 rounded-clay-sm object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-clay-sm bg-primary text-xs font-semibold text-primary-fg">
                      {invite.organization?.name?.[0] || "?"}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-text">{invite.organization?.name}</p>
                    {invite.category && <p className="text-xs text-text-muted">Category: {invite.category}</p>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleAcceptInvite(invite.membershipId)}
                  disabled={acceptingId === invite.membershipId}
                  className="clay-btn-primary px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  {acceptingId === invite.membershipId ? "Accepting..." : "Accept"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

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

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("attendance")}
          className={tab === "attendance" ? "clay-btn-primary" : "clay-btn-secondary"}
        >
          <MdListAlt aria-hidden="true" /> Attendance
        </button>
        <button
          type="button"
          onClick={() => setTab("analytics")}
          className={tab === "analytics" ? "clay-btn-primary" : "clay-btn-secondary"}
        >
          <MdInsertChartOutlined aria-hidden="true" /> Analytics
        </button>
      </div>

      {tab === "analytics" ? (
        user?.role === "admin" ? <AdminAnalytics /> : <MemberAnalytics />
      ) : (
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
                    onChange={(e) => {
                      setCategoryFilter(e.target.value);
                      setPage(1);
                    }}
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
            <>
              <ul className="divide-y divide-border">
                {records.map((record) => (
                  <li key={record._id} className="flex items-center justify-between gap-3 py-3 text-sm text-text-muted">
                    <span>
                      {user?.role === "admin" && (
                        <span className="font-medium text-text">{record.person?.name || record.memberName} — </span>
                      )}
                      {new Date(record.markedAt).toLocaleString()}
                    </span>
                    <span className="flex items-center gap-2">
                      {record.lateBy && (
                        <span className="rounded-full bg-surface-raised px-2 py-0.5 text-xs font-medium text-danger">
                          {record.lateBy}
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${record.markedVia === "admin" ? "bg-surface-raised text-warning" : "bg-surface-raised text-primary"
                          }`}
                      >
                        {record.markedVia === "admin" ? "Admin Entry" : "Kiosk"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="clay-btn-secondary px-3 py-1.5 disabled:opacity-40"
                    aria-label="Previous page"
                  >
                    <MdChevronLeft aria-hidden="true" />
                  </button>
                  <span className="text-sm text-text-muted">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="clay-btn-secondary px-3 py-1.5 disabled:opacity-40"
                    aria-label="Next page"
                  >
                    <MdChevronRight aria-hidden="true" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;