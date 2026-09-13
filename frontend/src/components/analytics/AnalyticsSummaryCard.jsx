import { useEffect, useState } from "react";
import axiosInstance from "../../api/axiosInstance";
import ExpandableSummaryCard from "./ExpandableSummaryCard";
import Loader from "../common/Loader";

const SECTION_TITLES = {
  overview: "Overview",
  attendanceTrend: "Attendance trend",
  categoryBreakdown: "Category breakdown",
  flaggedMatches: "Flagged matches",
  lateEntries: "Late entries",
  performers: "Performers",
};

function AnalyticsSummaryCard({ dateRange }) {
  const [sections, setSections] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!dateRange) return;
    let isMounted = true;

    async function fetchSections() {
      try {
        setLoading(true);
        setError("");
        const res = await axiosInstance.get("/analytics/organization/summary", {
          params: dateRange,
        });
        if (isMounted) {
          setSections(res.data?.data?.sections || null);
        }
      } catch (err) {
        if (isMounted) {
          setError("Couldn't generate summary right now. Try again shortly.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchSections();
    return () => {
      isMounted = false;
    };
    // dateRange is a new object on every DateRangeFilter change; keying off
    // from/to avoids refetching when an equivalent-but-new object comes in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange?.from, dateRange?.to]);

  if (loading) {
    return <Loader size="md" label="Generating insights..." className="py-6" />;
  }

  if (error) {
    return <p className="text-sm text-danger">{error}</p>;
  }

  if (!sections) return null;

  const entries = Object.entries(SECTION_TITLES).filter(([key]) => sections[key]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-text">Insights</h3>
        <button
          type="button"
          onClick={() => setShowAll((s) => !s)}
          className="text-xs font-medium text-primary hover:underline"
        >
          {showAll ? "Show as row" : "View all"}
        </button>
      </div>

      {showAll ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map(([key, title]) => (
            <ExpandableSummaryCard key={key} title={title} text={sections[key]} />
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
          {entries.map(([key, title]) => (
            <div key={key} className="w-64 sm:w-72 flex-shrink-0 snap-start">
              <ExpandableSummaryCard title={title} text={sections[key]} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AnalyticsSummaryCard;