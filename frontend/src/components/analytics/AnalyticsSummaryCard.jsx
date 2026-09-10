import { useEffect, useState } from "react";
import axiosInstance from "../../api/axiosInstance";

function AnalyticsSummaryCard() {
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function fetchSummary() {
      try {
        setLoading(true);
        setError("");
        const res = await axiosInstance.get("/analytics/organization/summary");
        if (isMounted) {
          setSummary(res.data?.data?.summary || "");
        }
      } catch (err) {
        if (isMounted) {
          setError("Couldn't generate summary right now. Try again shortly.", err.message);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchSummary();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="clay-card mb-6">
      <h3 className="text-lg font-semibold text-text mb-3">
        Attendance Insights
      </h3>

      {loading && (
        <p className="clay-notice animate-pulse">Generating summary...</p>
      )}

      {!loading && error && (
        <p className="text-sm text-danger">{error}</p>
      )}

      {!loading && !error && summary && (
        <p className="text-sm text-text-muted leading-relaxed">{summary}</p>
      )}
    </div>
  );
}

export default AnalyticsSummaryCard;