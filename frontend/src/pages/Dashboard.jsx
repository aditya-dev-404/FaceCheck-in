/**
 * Landing page after login. Members see their own attendance history and
 * links to enroll/mark attendance; admins additionally see the full
 * organization's attendance log, a category filter, and a CSV export.
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axiosInstance from "../api/axiosInstance";
import useAuth from "../hooks/useAuth";
import {
  MdAccessTime,
  MdChevronLeft,
  MdChevronRight,
  MdDownload,
  MdGroup,
  MdHowToReg,
  MdInsertChartOutlined,
  MdListAlt,
  MdMailOutline,
  MdPersonAdd,
  MdSettings,
  MdVerifiedUser,
} from "react-icons/md";
import AdminAnalytics from "../components/analytics/AdminAnalytics";
import MemberAnalytics from "../components/analytics/MemberAnalytics";
import Loader from "../components/common/Loader";

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

const ActionTile = ({ to, icon: Icon, title, description, primary }) => (
  <Link
    to={to}
    className={`group flex items-center gap-4 rounded-clay p-4 transition duration-200 hover:-translate-y-0.5 ${
      primary ? "bg-primary text-primary-fg shadow-clay" : "bg-surface text-text shadow-clay-sm"
    }`}
  >
    <span
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-clay-sm text-xl ${
        primary ? "bg-white/20" : "bg-surface-raised text-primary shadow-clay-inset"
      }`}
    >
      <Icon aria-hidden="true" />
    </span>
    <span className="min-w-0">
      <span className="block text-sm font-semibold">{title}</span>
      <span className={`block text-xs ${primary ? "opacity-80" : "text-text-muted"}`}>{description}</span>
    </span>
  </Link>
);

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

  const isAdmin = user?.role === "admin";
  const today = new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="clay-page space-y-6">
      {/* Hero header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-clay bg-surface p-6 shadow-clay-sm">
        <div className="flex items-center gap-4">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="h-14 w-14 rounded-full object-cover shadow-clay-sm" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-fg shadow-clay-sm">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-primary">{isAdmin ? "Organization overview" : "Your attendance"}</p>
            <h1 className="mt-0.5 text-2xl font-semibold text-text">
              {greeting()}, {user?.name}
            </h1>
            <p className="mt-0.5 text-xs text-text-muted">{today}</p>
          </div>
        </div>
        <div className="hidden h-12 w-12 items-center justify-center rounded-clay-sm bg-surface-raised text-primary shadow-clay-inset sm:flex">
          <MdVerifiedUser aria-hidden="true" className="text-2xl" />
        </div>
      </div>

      {/* Pending invites */}
      {!invitesLoading && invites.length > 0 && (
        <div className="space-y-3 rounded-clay bg-surface p-5 shadow-clay-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-text">
            <MdMailOutline aria-hidden="true" className="text-lg text-primary" />
            {invites.length === 1
              ? "You've been invited to join an organization"
              : `You've been invited to join ${invites.length} organizations`}
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
                    <img src={invite.organization.logoUrl} alt="" className="h-9 w-9 rounded-clay-sm object-cover" />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-clay-sm bg-primary text-xs font-semibold text-primary-fg">
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

      {/* Quick actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {!user?.isEnrolled && (
          <ActionTile
            to="/enroll"
            icon={MdPersonAdd}
            title="Enroll your face"
            description="Required before attendance can be marked"
            primary
          />
        )}
        {isAdmin ? (
          <>
            <ActionTile
              to="/attendance"
              icon={MdHowToReg}
              title="Mark attendance"
              description="Manual entry from a group photo"
              primary={user?.isEnrolled}
            />
            <ActionTile
              to="/manage-members"
              icon={MdGroup}
              title="Manage members"
              description="View, edit and review your team"
            />
            <ActionTile
              to="/manage-organization"
              icon={MdSettings}
              title="Organization"
              description="Categories, kiosk and settings"
            />
          </>
        ) : (
          <div className="flex items-center gap-4 rounded-clay bg-surface p-4 shadow-clay-sm">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-clay-sm bg-surface-raised text-xl text-primary shadow-clay-inset">
              <MdHowToReg aria-hidden="true" />
            </span>
            <p className="text-sm text-text-muted">Attendance is marked automatically at your organization's kiosk</p>
          </div>
        )}
      </div>

      {/* Segmented tabs */}
      <div className="inline-flex rounded-clay-sm bg-surface-raised p-1 shadow-clay-inset">
        {[
          { key: "attendance", label: "Attendance", icon: MdListAlt },
          { key: "analytics", label: "Analytics", icon: MdInsertChartOutlined },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 rounded-clay-sm px-4 py-2 text-sm font-medium transition ${
              tab === key ? "bg-primary text-primary-fg shadow-clay-sm" : "text-text-muted hover:text-text"
            }`}
          >
            <Icon aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

      {tab === "analytics" ? (
        isAdmin ? (
          <AdminAnalytics />
        ) : (
          <MemberAnalytics />
        )
      ) : (
        <div className="rounded-clay bg-surface p-5 shadow-clay-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-text">
                {isAdmin ? "Organization attendance" : "Your attendance history"}
              </h2>
              <p className="text-xs text-text-muted">Most recent check-ins first</p>
            </div>
            {isAdmin && (
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
            <Loader size="lg" label="Loading..." className="py-12" />
          ) : records.length === 0 ? (
            <p className="clay-notice">No attendance records yet.</p>
          ) : (
            <>
              <ul className="space-y-2">
                {records.map((record) => {
                  const name = record.person?.name || record.memberName;
                  const date = new Date(record.markedAt);
                  return (
                    <li
                      key={record._id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-clay-sm bg-surface-raised px-4 py-3 shadow-clay-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-sm font-semibold text-primary shadow-clay-inset">
                          {isAdmin ? (
                            name?.charAt(0).toUpperCase() || "?"
                          ) : (
                            <MdAccessTime aria-hidden="true" className="text-lg" />
                          )}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-text">
                            {isAdmin
                              ? name
                              : date.toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" })}
                          </p>
                          <p className="text-xs text-text-muted">
                            {isAdmin
                              ? `${date.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })} · ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                              : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {record.lateBy && (
                          <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-medium text-danger shadow-clay-sm">
                            {record.lateBy}
                          </span>
                        )}
                        <span
                          className={`rounded-full bg-surface px-2.5 py-0.5 text-xs font-medium shadow-clay-sm ${
                            record.markedVia === "admin" ? "text-warning" : "text-primary"
                          }`}
                        >
                          {record.markedVia === "admin" ? "Admin Entry" : "Kiosk"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {totalPages > 1 && (
                <div className="mt-5 flex items-center justify-center gap-4">
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