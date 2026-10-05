import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axiosInstance from "../api/axiosInstance";
import useAuth from "../hooks/useAuth";

const MyOrganizations = () => {
  const { switchOrganization } = useAuth();
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [switchingId, setSwitchingId] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await axiosInstance.get("/auth/organizations");
        setOrganizations(data.data.organizations);
      } catch (err) {
        setError(err.response?.data?.message || "Could not load your organizations");
      } finally {
        setLoading(false);
      }
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, no race condition
    load();
  }, []);

  const handleSwitch = async (membershipId) => {
    setSwitchingId(membershipId);
    setError("");
    try {
      await switchOrganization(membershipId);
      // Full load so every page refetches data for the new org.
      window.location.assign("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Could not switch organization");
      setSwitchingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-text">My Organizations</h1>
        <Link to="/dashboard" className="clay-btn-secondary">
          Back
        </Link>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {loading ? (
        <p className="text-sm text-text-muted">Loading...</p>
      ) : organizations.length === 0 ? (
        <p className="text-sm text-text-muted">You aren't an active member of any organization yet.</p>
      ) : (
        <ul className="space-y-3">
          {organizations.map((o) => (
            <li
              key={o.membershipId}
              className={`clay-card flex items-center gap-3 p-4 ${o.isActive ? "" : "opacity-60"}`}
            >
              {o.organization.logoUrl ? (
                <img
                  src={o.organization.logoUrl}
                  alt=""
                  className="h-11 w-11 shrink-0 rounded-clay-sm object-cover shadow-clay-sm"
                />
              ) : (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-clay-sm bg-primary text-sm font-semibold text-primary-fg shadow-clay-sm">
                  {o.organization.name?.[0] || "?"}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-text">{o.organization.name}</p>
                <p className="truncate text-xs text-text-muted capitalize">
                  {o.role}
                  {o.category && o.role !== "admin" ? ` · ${o.category}` : ""}
                  {!o.isActive ? " · Deactivated" : ""}
                </p>
              </div>

              {o.isCurrent ? (
                <span className="shrink-0 rounded-full bg-surface-raised px-3 py-1 text-xs font-medium text-text shadow-clay-sm">
                  Current
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSwitch(o.membershipId)}
                  disabled={!o.isActive || switchingId !== null}
                  className="clay-btn-primary shrink-0 disabled:opacity-50"
                >
                  {switchingId === o.membershipId ? "Switching..." : "Switch"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MyOrganizations;