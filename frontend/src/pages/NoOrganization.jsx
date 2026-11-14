import { useEffect, useState } from "react";
import { MdBusiness, MdMailOutline } from "react-icons/md";
import axiosInstance from "../api/axiosInstance";
import useAuth from "../hooks/useAuth";
import Loader from "../components/common/Loader";

/**
 * Shown instead of the app when a logged-in person has no active
 * organization — they left, an admin removed them, or they were never
 * accepted anywhere yet. The only way back in is an admin adding them by
 * email, which shows up here as an invite to accept.
 */
const NoOrganization = () => {
  const { user } = useAuth();
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    axiosInstance
      .get("/users/me/invites")
      .then(({ data }) => setInvites(data.data.invites))
      .catch(() => setInvites([]))
      .finally(() => setLoading(false));
  }, []);

  const handleAccept = async (membershipId) => {
    setAcceptingId(membershipId);
    setError("");
    try {
      await axiosInstance.patch(`/users/me/invites/${membershipId}/accept`);
      // Full load so the whole app picks up the new organization.
      window.location.assign("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Could not accept invite");
      setAcceptingId(null);
    }
  };

  return (
    <div className="clay-page max-w-2xl space-y-6">
      <div className="rounded-clay bg-surface p-6 shadow-clay-sm">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-clay-sm bg-surface-raised text-2xl text-primary shadow-clay-inset">
            <MdBusiness aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-text">You're not in an organization right now</h1>
            <p className="mt-1 text-sm text-text-muted">
              Ask an organization admin to add you using <span className="font-medium text-text">{user?.email}</span>.
              The invite will appear here once they do.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <Loader size="lg" label="Loading..." className="py-8" />
      ) : (
        invites.length > 0 && (
          <div className="space-y-3 rounded-clay bg-surface p-5 shadow-clay-sm">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-text">
              <MdMailOutline aria-hidden="true" className="text-lg text-primary" />
              {invites.length === 1 ? "You've been invited to join an organization" : `You've been invited to join ${invites.length} organizations`}
            </h2>
            {error && <p className="text-sm text-danger">{error}</p>}
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
                    onClick={() => handleAccept(invite.membershipId)}
                    disabled={acceptingId === invite.membershipId}
                    className="clay-btn-primary px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    {acceptingId === invite.membershipId ? "Accepting..." : "Accept"}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )
      )}
    </div>
  );
};

export default NoOrganization;