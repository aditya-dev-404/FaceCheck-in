import { useState, useEffect } from "react";
import { Navigate, Link, useParams } from "react-router-dom";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  MdArrowBack,
  MdChevronLeft,
  MdChevronRight,
  MdDownload,
  MdFlag,
  MdPersonOff,
  MdPersonOutline,
} from "react-icons/md";
import axiosInstance from "../api/axiosInstance";
import useAuth from "../hooks/useAuth";
import useConfirm from "../hooks/useConfirm";
import { getMemberDetails, getMemberStats, getMemberRecords, downloadMemberCsv } from "../api/members.api";

const PRESETS = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

const toDateInput = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

const presetRange = (days) => {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - days);
  return { from: toDateInput(from), to: toDateInput(to) };
};

const pct = (rate) => `${Math.round((rate || 0) * 100)}%`;
const fmtDate = (value) => (value ? new Date(value).toLocaleDateString() : "—");
const fmtDateTime = (value) => (value ? new Date(value).toLocaleString() : "—");

const StatTile = ({ label, value, hint }) => (
  <div className="rounded-clay bg-surface p-4 shadow-clay-sm">
    <p className="text-xs text-text-muted">{label}</p>
    <p className="mt-1 text-2xl font-semibold text-text">{value}</p>
    {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
  </div>
);

const MemberDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const confirm = useConfirm();

  const [member, setMember] = useState(null);
  const [memberError, setMemberError] = useState("");
  const [preset, setPreset] = useState(30);
  const [range, setRange] = useState(() => presetRange(30));
  const [stats, setStats] = useState(null);
  const [recordsData, setRecordsData] = useState({ records: [], total: 0, page: 1, pages: 1 });
  const [page, setPage] = useState(1);
  const [loadingData, setLoadingData] = useState(true);
  const [exporting, setExporting] = useState(false);

  const isAdmin = user?.role === "admin";

  const fetchMember = async () => {
    try {
      setMember(await getMemberDetails(id));
    } catch (err) {
      setMemberError(err.response?.data?.message || "Could not load member");
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, no race condition
    fetchMember();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when the member id changes
  }, [id, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    const load = async () => {
      try {
        const data = await getMemberStats(id, range);
        if (!cancelled) setStats(data);
      } catch {
        if (!cancelled) setStats(null);
      }
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refetch on range change, stale responses ignored via `cancelled`
    load();
    return () => {
      cancelled = true;
    };
  }, [id, range, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    const load = async () => {
      setLoadingData(true);
      try {
        const data = await getMemberRecords(id, { ...range, page, limit: 10 });
        if (!cancelled) setRecordsData(data);
      } catch {
        if (!cancelled) setRecordsData({ records: [], total: 0, page: 1, pages: 1 });
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refetch on range/page change, stale responses ignored via `cancelled`
    load();
    return () => {
      cancelled = true;
    };
  }, [id, range, page, isAdmin]);

  if (user && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const selectPreset = (days) => {
    setPreset(days);
    setRange(presetRange(days));
    setPage(1);
  };

  const changeCustom = (key, value) => {
    setPreset("custom");
    setRange((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const toggleActive = async () => {
    await axiosInstance.patch(`/users/${id}/${member.isActive ? "deactivate" : "activate"}`);
    fetchMember();
  };

  const unflag = async () => {
    await axiosInstance.patch(`/users/${id}/unflag`);
    fetchMember();
  };

  const deleteFlagImage = async () => {
    const ok = await confirm({
      title: "Delete flagged image?",
      message: "The member will stay flagged, but this review image will be gone.",
      confirmText: "Delete image",
      tone: "danger",
    });
    if (!ok) return;
    await axiosInstance.delete(`/users/${id}/flag-image`);
    fetchMember();
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadMemberCsv(id, range);
    } finally {
      setExporting(false);
    }
  };

  const statusLabel = (record) => {
    if (record.lateBy) return { text: record.lateBy, className: "text-danger" };
    if (member?.checkInTime) return { text: "On time", className: "text-success" };
    return { text: "—", className: "text-text-muted" };
  };

  if (memberError) {
    return (
      <div className="clay-page">
        <p className="text-sm text-danger">{memberError}</p>
        <Link to="/manage-members" className="clay-action mt-4 inline-flex items-center gap-1 px-3 py-2 text-sm">
          <MdArrowBack aria-hidden="true" /> Back to members
        </Link>
      </div>
    );
  }

  if (!member) return <p className="clay-page text-sm text-text-muted">Loading member...</p>;

  return (
    <div className="clay-page space-y-6 pb-24">
      <Link to="/manage-members" className="inline-flex items-center gap-1 text-sm font-medium text-primary">
        <MdArrowBack aria-hidden="true" /> Back to members
      </Link>

      {/* Profile header */}
      <div className="rounded-clay bg-surface p-5 shadow-clay-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {member.avatarUrl ? (
              <img src={member.avatarUrl} alt={member.name} className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-raised text-xl font-semibold text-primary shadow-clay-sm">
                {member.name?.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-semibold text-text">{member.name}</h1>
              <p className="text-sm text-text-muted">{member.email}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="clay-badge">{member.category || "No category"}</span>
                <span className={`clay-badge ${member.isActive ? "text-success" : "text-text-muted"}`}>
                  {member.isActive ? "Active" : "Deactivated"}
                </span>
                <span className={`clay-badge ${member.isEnrolled ? "text-success" : ""}`}>
                  {member.isEnrolled ? "Enrolled" : "Pending enrollment"}
                </span>
                {member.isFlagged && (
                  <span className="clay-badge text-danger">
                    <MdFlag aria-hidden="true" className="mr-1 inline" /> Flagged
                  </span>
                )}
              </div>
            </div>
          </div>

          <button type="button" onClick={toggleActive} className="clay-action inline-flex items-center gap-1 px-3 py-2 text-sm">
            {member.isActive ? <MdPersonOff aria-hidden="true" /> : <MdPersonOutline aria-hidden="true" />}
            {member.isActive ? "Deactivate" : "Activate"}
          </button>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-text-muted">Check-in time</dt>
            <dd className="text-text">
              {member.checkInTime ? `${member.checkInTime} (+${member.gracePeriodMinutes} min grace)` : "Not assigned"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Joined</dt>
            <dd className="text-text">{fmtDate(member.joinedAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Face enrolled</dt>
            <dd className="text-text">{member.isEnrolled ? fmtDate(member.enrolledAt) : "Not enrolled"}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Last check-in</dt>
            <dd className="text-text">{fmtDateTime(stats?.lastCheckIn)}</dd>
          </div>
        </dl>

        {member.isFlagged && (
          <div className="mt-5 rounded-clay-sm bg-surface-raised p-4 shadow-clay-sm">
            <p className="text-sm font-medium text-danger">Flagged for review</p>
            <p className="mt-1 text-sm text-text-muted">{member.flagReason || "No reason recorded"}</p>
            <p className="text-xs text-text-muted">{fmtDateTime(member.flaggedAt)}</p>
            {member.flaggedImageUrl && (
              <img
                src={member.flaggedImageUrl}
                alt={`Flagged capture of ${member.name}`}
                className="mt-3 max-h-48 rounded-md border border-border"
              />
            )}
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={unflag} className="clay-action px-3 py-1.5 text-xs text-danger">
                Unflag
              </button>
              {member.flaggedImageUrl && (
                <button type="button" onClick={deleteFlagImage} className="clay-action px-3 py-1.5 text-xs">
                  Delete image
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Date range */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.days}
            type="button"
            onClick={() => selectPreset(p.days)}
            className={preset === p.days ? "clay-btn-primary px-3 py-1.5 text-sm" : "clay-action px-3 py-1.5 text-sm"}
          >
            {p.label}
          </button>
        ))}
        <input
          type="date"
          value={range.from}
          max={range.to}
          onChange={(e) => changeCustom("from", e.target.value)}
          className="clay-input w-auto py-1.5 text-sm"
          aria-label="From date"
        />
        <span className="text-sm text-text-muted">to</span>
        <input
          type="date"
          value={range.to}
          min={range.from}
          onChange={(e) => changeCustom("to", e.target.value)}
          className="clay-input w-auto py-1.5 text-sm"
          aria-label="To date"
        />
      </div>

      {/* Stat tiles */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile
            label="Attendance rate"
            value={pct(stats.attendanceRate)}
            hint={`Category average ${pct(stats.categoryAvgRate)} · rank ${stats.rank} of ${stats.totalInCategory}`}
          />
          <StatTile label="Days present" value={stats.totalPresent} />
          <StatTile
            label="Late arrivals"
            value={stats.lateCount}
            hint={stats.lateCount ? `Avg ${stats.avgLateMinutes} min late` : "No late arrivals"}
          />
          <StatTile label="Current streak" value={`${stats.streak} day${stats.streak === 1 ? "" : "s"}`} />
          <StatTile label="Flagged check-ins" value={stats.flaggedCount} />
        </div>
      )}

      {/* Weekly trend */}
      {stats && (
        <div className="rounded-clay bg-surface p-5 shadow-clay-sm">
          <h2 className="mb-3 text-base font-semibold text-text">Weekly attendance</h2>
          {stats.weeklyTrend.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-muted">No attendance in this range.</p>
          ) : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.weeklyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d6ddd5" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="present" name="Days present" stroke="#3F7A52" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Attendance records */}
      <div className="rounded-clay bg-surface shadow-clay-sm">
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="text-base font-semibold text-text">Attendance records</h2>
          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting || recordsData.total === 0}
            className="clay-action inline-flex items-center gap-1 px-3 py-1.5 text-xs"
          >
            <MdDownload aria-hidden="true" /> {exporting ? "Exporting..." : "Export CSV"}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="mt-3 min-w-full divide-y divide-border text-sm">
            <thead className="bg-surface-raised text-left text-xs font-medium uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Match score</th>
                <th className="px-4 py-3">Marked via</th>
                <th className="px-4 py-3">Flagged</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loadingData ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                    Loading records...
                  </td>
                </tr>
              ) : recordsData.records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                    No attendance records in this range.
                  </td>
                </tr>
              ) : (
                recordsData.records.map((record) => {
                  const status = statusLabel(record);
                  return (
                    <tr key={record._id}>
                      <td className="px-4 py-3 text-text">{fmtDate(record.markedAt)}</td>
                      <td className="px-4 py-3 text-text-muted">
                        {new Date(record.markedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className={`px-4 py-3 ${status.className}`}>{status.text}</td>
                      <td className="px-4 py-3 text-text-muted">{record.matchScore.toFixed(3)}</td>
                      <td className="px-4 py-3 text-text-muted">{record.markedVia}</td>
                      <td className="px-4 py-3">
                        {record.isFlagged ? <span className="clay-badge text-danger">Flagged</span> : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-5 py-3 text-xs text-text-muted">
          <span>
            {recordsData.total} record{recordsData.total === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1}
              className="clay-action p-1.5"
              aria-label="Previous page"
            >
              <MdChevronLeft aria-hidden="true" />
            </button>
            <span>
              Page {recordsData.page} of {recordsData.pages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(p + 1, recordsData.pages))}
              disabled={page >= recordsData.pages}
              className="clay-action p-1.5"
              aria-label="Next page"
            >
              <MdChevronRight aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemberDetail;