import { useEffect, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { getOrganizationAnalytics } from "../../api/analytics.api";
import { useTheme } from "../../hooks/useTheme";
import { getChartColors } from "../../lib/chartTheme";
import AnalyticsSummaryCard from "./AnalyticsSummaryCard";
import DateRangeFilter from "./DateRangeFilter";
import Loader from "../common/Loader";

export default function AdminAnalytics() {
  const { theme } = useTheme();
  const colors = getChartColors(theme);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null); // "members" | "today" | null
  const [dateRange, setDateRange] = useState(null);

  useEffect(() => {
    if (!dateRange) return;
    getOrganizationAnalytics(dateRange)
      .then(setData)
      .catch(() => setError("Could not load analytics."));
  }, [dateRange]);

  if (error) return <p className="text-sm text-danger">{error}</p>;

  return (
    <div className="space-y-6">
      <DateRangeFilter onChange={setDateRange} />

      {!data ? (
        <Loader size="lg" label="Loading analytics..." className="py-12" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <SummaryCard label="Members" value={data.summary.totalMembers} onClick={() => setModal("members")} />
            <SummaryCard label="Avg attendance" value={`${Math.round(data.summary.avgAttendanceRate * 100)}%`} />
            <SummaryCard label="Today's check-ins" value={data.summary.todayCheckins} onClick={() => setModal("today")} />
            <SummaryCard label="Flags this month" value={data.summary.totalFlagsThisMonth} />
            <SummaryCard label="Late rate" value={`${Math.round(data.summary.lateRate * 100)}%`} />
          </div>

          <AnalyticsSummaryCard dateRange={dateRange} />

          <div className="clay-card">
            <h3 className="font-medium text-text mb-3">Attendance trend</h3>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data.dailyTrend}>
                <CartesianGrid stroke={colors.grid} strokeDasharray="4 4" />
                <XAxis dataKey="date" tick={{ fill: colors.muted, fontSize: 11 }} minTickGap={24} />
                <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fill: colors.muted, fontSize: 11 }} />
                <Tooltip formatter={(v) => `${Math.round(v * 100)}%`} />
                <Line type="monotone" dataKey="rate" stroke={colors.primary} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="clay-card">
            <h3 className="font-medium text-text mb-3">Attendance by category</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.byCategory}>
                <CartesianGrid stroke={colors.grid} strokeDasharray="4 4" />
                <XAxis dataKey="category" tick={{ fill: colors.muted, fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fill: colors.muted, fontSize: 11 }} />
                <Tooltip formatter={(v) => `${Math.round(v * 100)}%`} />
                <Bar dataKey="avgRate" fill={colors.primary} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="clay-card">
            <h3 className="font-medium text-text mb-3">Flagged match rate</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.flaggedTrend}>
                <CartesianGrid stroke={colors.grid} strokeDasharray="4 4" />
                <XAxis dataKey="date" tick={{ fill: colors.muted, fontSize: 11 }} minTickGap={24} />
                <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fill: colors.muted, fontSize: 11 }} />
                <Tooltip formatter={(v) => `${Math.round(v * 100)}%`} />
                <Line type="monotone" dataKey="rate" stroke={colors.danger} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="clay-card">
            <h3 className="font-medium text-text mb-3">
              Late-entry rate <span className="text-text-muted font-normal text-sm">(avg {data.lateStats.avgLateMinutes}m late)</span>
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.lateTrend}>
                <CartesianGrid stroke={colors.grid} strokeDasharray="4 4" />
                <XAxis dataKey="date" tick={{ fill: colors.muted, fontSize: 11 }} minTickGap={24} />
                <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fill: colors.muted, fontSize: 11 }} />
                <Tooltip formatter={(v) => `${Math.round(v * 100)}%`} />
                <Line type="monotone" dataKey="rate" stroke={colors.danger} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="clay-card">
            <h3 className="font-medium text-text mb-3">Late rate by category</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.lateByCategory}>
                <CartesianGrid stroke={colors.grid} strokeDasharray="4 4" />
                <XAxis dataKey="category" tick={{ fill: colors.muted, fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fill: colors.muted, fontSize: 11 }} />
                <Tooltip formatter={(v) => `${Math.round(v * 100)}%`} />
                <Bar dataKey="lateRate" fill={colors.danger} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Leaderboard title="Top performers" rows={data.topPerformers} />
            <Leaderboard title="Needs attention" rows={data.bottomPerformers} />
          </div>

          {modal === "members" && (
            <Modal title="All members by attendance" onClose={() => setModal(null)}>
              <ul className="space-y-2">
                {data.allMembers.map((r) => (
                  <li key={r.userId} className="flex items-center justify-between text-sm">
                    <span className="text-text">{r.name} <span className="text-text-muted">({r.category})</span></span>
                    <span className="font-medium text-primary">{Math.round(r.rate * 100)}%</span>
                  </li>
                ))}
              </ul>
            </Modal>
          )}

          {modal === "today" && (
            <Modal title="Today's check-ins" onClose={() => setModal(null)}>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-primary mb-2">
                    Checked in ({data.todayStatus.filter((m) => m.checkedIn).length})
                  </h4>
                  <ul className="space-y-1">
                    {data.todayStatus.filter((m) => m.checkedIn).map((m) => (
                      <li key={m.userId} className="text-sm text-text">
                        {m.name} <span className="text-text-muted">({m.category})</span>
                      </li>
                    ))}
                    {data.todayStatus.filter((m) => m.checkedIn).length === 0 && (
                      <li className="text-sm text-text-muted">No one yet.</li>
                    )}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-danger mb-2">
                    Not checked in ({data.todayStatus.filter((m) => !m.checkedIn).length})
                  </h4>
                  <ul className="space-y-1">
                    {data.todayStatus.filter((m) => !m.checkedIn).map((m) => (
                      <li key={m.userId} className="text-sm text-text">
                        {m.name} <span className="text-text-muted">({m.category})</span>
                      </li>
                    ))}
                    {data.todayStatus.filter((m) => !m.checkedIn).length === 0 && (
                      <li className="text-sm text-text-muted">Everyone has checked in.</li>
                    )}
                  </ul>
                </div>
              </div>
            </Modal>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`clay-card py-4 text-center ${onClick ? "hover:shadow-clay-inset transition-shadow cursor-pointer" : ""}`}
    >
      <div className="text-xl font-medium text-text">{value}</div>
      <div className="text-xs text-text-muted mt-1">{label}</div>
    </Tag>
  );
}

function Leaderboard({ title, rows }) {
  return (
    <div className="clay-card">
      <h3 className="font-medium text-text mb-3">{title}</h3>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.userId} className="flex items-center justify-between text-sm">
            <span className="text-text">{r.name} <span className="text-text-muted">({r.category})</span></span>
            <span className="font-medium text-primary">{Math.round(r.rate * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm rounded-t-clay sm:rounded-clay bg-surface p-6 shadow-clay max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-text">{title}</h3>
          <button type="button" onClick={onClose} className="text-text-muted hover:text-text">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}