import { useEffect, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import { getMemberAnalytics } from "../../api/analytics.api";
import { useTheme } from "../../hooks/useTheme";
import { getChartColors } from "../../lib/chartTheme";

export default function MemberAnalytics() {
  const { theme } = useTheme();
  const colors = getChartColors(theme);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getMemberAnalytics({})
      .then(setData)
      .catch(() => setError("Could not load analytics."));
  }, []);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!data) return <p className="text-sm text-text-muted">Loading analytics...</p>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <div className="clay-card py-4 text-center">
          <div className="text-xl font-medium text-text">{Math.round(data.myRate * 100)}%</div>
          <div className="text-xs text-text-muted mt-1">Your attendance</div>
        </div>
        <div className="clay-card py-4 text-center">
          <div className="text-xl font-medium text-text">{Math.round(data.categoryAvgRate * 100)}%</div>
          <div className="text-xs text-text-muted mt-1">Category average</div>
        </div>
        <div className="clay-card py-4 text-center">
          <div className="text-xl font-medium text-text">{data.rank}/{data.totalInCategory}</div>
          <div className="text-xs text-text-muted mt-1">Your rank</div>
        </div>
      </div>

      <div className="clay-card">
        <h3 className="font-medium text-text mb-3">Weekly check-ins vs category average</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data.weeklyTrend}>
            <CartesianGrid stroke={colors.grid} strokeDasharray="4 4" />
            <XAxis dataKey="week" tick={{ fill: colors.muted, fontSize: 11 }} />
            <YAxis tick={{ fill: colors.muted, fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="present" fill={colors.primary} radius={[6, 6, 0, 0]} />
            <ReferenceLine
              y={data.categoryAvgRate * 5}
              stroke={colors.danger}
              strokeDasharray="4 4"
              label={{ value: "Category avg", fill: colors.danger, fontSize: 11, position: "insideTopRight" }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}