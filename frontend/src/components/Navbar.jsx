import { useState } from "react";
import { Link } from "react-router-dom";
import axiosInstance from "../api/axiosInstance";
import useAuth from "../hooks/useAuth";
import ThemeToggle from "./ThemeToggle"

const Navbar = () => {
  const { user, logout, refreshUser, switchOrganization } = useAuth();
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const [showOrgMenu, setShowOrgMenu] = useState(false);
  const [orgs, setOrgs] = useState([]);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [switchingId, setSwitchingId] = useState(null);
  const [orgError, setOrgError] = useState("");

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");
    const formData = new FormData();
    formData.append("avatar", file);

    try {
      await axiosInstance.post("/users/me/avatar", formData);
      await refreshUser();
    } catch (err) {
      setError(err.response?.data?.message || "Could not upload avatar");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setUploading(true);
    setError("");
    try {
      await axiosInstance.delete("/users/me/avatar");
      await refreshUser();
    } catch (err) {
      setError(err.response?.data?.message || "Could not remove avatar");
    } finally {
      setUploading(false);
    }
  };

  // Orgs are fetched when the menu opens, so the list is always current.
  const toggleOrgMenu = async () => {
    if (showOrgMenu) {
      setShowOrgMenu(false);
      return;
    }
    setShowOrgMenu(true);
    setOrgError("");
    setOrgsLoading(true);
    try {
      const { data } = await axiosInstance.get("/auth/organizations");
      setOrgs(data.data.organizations);
    } catch (err) {
      setOrgs([]);
      setOrgError(err.response?.data?.message || "Could not load organizations");
    } finally {
      setOrgsLoading(false);
    }
  };

  const handleSwitch = async (membershipId) => {
    setSwitchingId(membershipId);
    setOrgError("");
    try {
      await switchOrganization(membershipId);
      // Full load so every page refetches data for the new org.
      window.location.assign("/dashboard");
    } catch (err) {
      setOrgError(err.response?.data?.message || "Could not switch organization");
      setSwitchingId(null);
    }
  };

  return (
   <>
      <nav className="flex items-center justify-between bg-surface rounded-b-clay shadow-clay-sm px-4 sm:px-6 py-3">
        <div className="relative flex items-center gap-1 min-w-0">
          <Link to="/dashboard" className="flex items-center gap-2 min-w-0">
            {user?.organization?.logoUrl ? (
              <img src={user.organization.logoUrl} alt="" className="h-9 w-9 rounded-clay-sm object-cover shadow-clay-sm shrink-0" />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-clay-sm bg-primary text-xs font-semibold text-primary-fg shadow-clay-sm">
                {user?.organization?.name?.[0] || "F"}
              </div>
            )}
            <span className="font-medium text-text truncate hidden xs:inline sm:inline">
              {user?.organization?.name || "FaceCheck-in"}
            </span>
          </Link>

          <button
            type="button"
            onClick={toggleOrgMenu}
            aria-label="Switch organization"
            aria-expanded={showOrgMenu}
            className="shrink-0 rounded-clay-sm px-2 py-1 text-xs text-text-muted hover:bg-surface-raised transition-shadow"
          >
            ▾
          </button>

          {showOrgMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowOrgMenu(false)} />
              <div className="absolute left-0 top-full z-50 mt-3 w-72 max-w-[85vw] space-y-1 rounded-clay bg-surface p-2 shadow-clay">
                <p className="px-2 pt-1 text-xs font-medium uppercase tracking-wide text-text-muted">
                  Your organizations
                </p>

                {orgsLoading ? (
                  <p className="px-2 py-2 text-sm text-text-muted">Loading...</p>
                ) : (
                  orgs.map((o) => (
                    <button
                      key={o.membershipId}
                      type="button"
                      onClick={() => !o.isCurrent && handleSwitch(o.membershipId)}
                      disabled={o.isCurrent || !o.isActive || switchingId !== null}
                      className={`flex w-full items-center gap-2 rounded-clay-sm px-2 py-2 text-left hover:bg-surface-raised disabled:cursor-default ${
                        o.isActive ? "" : "opacity-50"
                      }`}
                    >
                      {o.organization.logoUrl ? (
                        <img src={o.organization.logoUrl} alt="" className="h-8 w-8 shrink-0 rounded-clay-sm object-cover" />
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-clay-sm bg-primary text-xs font-semibold text-primary-fg">
                          {o.organization.name?.[0] || "?"}
                        </div>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-text">{o.organization.name}</span>
                        <span className="block truncate text-xs capitalize text-text-muted">
                          {o.role}
                          {!o.isActive ? " · Deactivated" : ""}
                        </span>
                      </span>
                      {o.isCurrent && <span className="shrink-0 text-xs font-medium text-primary">✓</span>}
                      {switchingId === o.membershipId && (
                        <span className="shrink-0 text-xs text-text-muted">...</span>
                      )}
                    </button>
                  ))
                )}

                {orgError && <p className="px-2 text-xs text-danger">{orgError}</p>}

                <Link
                  to="/my-organizations"
                  onClick={() => setShowOrgMenu(false)}
                  className="block rounded-clay-sm border-t border-border px-2 pt-3 pb-2 text-sm font-medium text-text hover:bg-surface-raised"
                >
                  My Organizations
                </Link>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <ThemeToggle />

          <button type="button" onClick={() => setShowAvatarModal(true)} className="flex items-center gap-2">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover shadow-clay-sm" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-raised text-xs font-semibold text-text shadow-clay-sm">
                {user?.name?.[0] || "?"}
              </div>
            )}
            <span className="text-sm text-text hidden sm:inline">{user?.name}</span>
          </button>
        </div>
      </nav>

      {showAvatarModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
          onClick={() => setShowAvatarModal(false)}
        >
          <div
            className="w-full sm:max-w-xs space-y-4 rounded-t-clay sm:rounded-clay bg-surface p-6 shadow-clay max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-medium text-text">Profile picture</h3>
            <div className="flex justify-center">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="h-24 w-24 rounded-full object-cover shadow-clay-sm" />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-surface-raised text-2xl font-medium text-text-muted shadow-clay-sm">
                  {user?.name?.[0] || "?"}
                </div>
              )}
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <label className="clay-btn-primary block w-full cursor-pointer">
              {uploading ? "Uploading..." : "Upload new picture"}
              <input type="file" accept="image/*" onChange={handleAvatarChange} disabled={uploading} className="hidden" />
            </label>
            {user?.avatarUrl && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                disabled={uploading}
                className="w-full rounded-clay-sm px-3 py-2.5 text-sm font-medium text-danger shadow-clay-sm hover:bg-surface-raised disabled:opacity-50 transition-shadow"
              >
                Remove picture
              </button>
            )}
            <div className="flex gap-2 border-t border-border pt-3">
              <button type="button" onClick={() => setShowAvatarModal(false)} className="clay-btn-secondary flex-1">
                Close
              </button>
              <button type="button" onClick={logout} className="clay-btn-secondary flex-1">
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;