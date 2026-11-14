import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { MdDashboard, MdGroup, MdSettings } from "react-icons/md";
import axiosInstance from "../api/axiosInstance";
import useAuth from "../hooks/useAuth";
import useConfirm from "../hooks/useConfirm";
import ThemeToggle from "./ThemeToggle";

// Links shown in the bar depend on the person's role. Someone with no active
// organization gets no links at all.
const adminLinks = [
  { to: "/dashboard", label: "Dashboard", icon: MdDashboard },
  { to: "/manage-members", label: "Members", icon: MdGroup },
  { to: "/manage-organization", label: "Organization", icon: MdSettings },
];

const memberLinks = [{ to: "/dashboard", label: "Dashboard", icon: MdDashboard }];

const navLinkClass = ({ isActive }) =>
  `group flex items-center gap-2 rounded-clay-sm px-2.5 py-2 text-sm font-medium transition-colors duration-200 sm:px-3 ${
    isActive
      ? "bg-surface-raised text-primary shadow-clay-inset"
      : "text-text-muted hover:bg-surface-raised hover:text-text"
  }`;

const Navbar = () => {
  const { user, logout, refreshUser } = useAuth();
  const confirm = useConfirm();
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState("");

  const links = !user?.organization ? [] : user.role === "admin" ? adminLinks : memberLinks;

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

  const handleLeave = async () => {
    const orgName = user?.organization?.name || "this organization";
    const ok = await confirm({
      title: "Leave organization?",
      message: `You'll leave ${orgName}. Only an admin can add you back.`,
      confirmText: "Leave",
      tone: "danger",
    });
    if (!ok) return;

    setLeaving(true);
    setError("");
    try {
      await axiosInstance.post("/users/me/leave");
      // Full load so every page drops the old organization's data.
      window.location.assign("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Could not leave the organization");
      setLeaving(false);
    }
  };

  return (
    <>
      <nav className="flex items-center justify-between gap-2 rounded-b-clay bg-surface px-3 py-2.5 shadow-clay-sm sm:gap-4 sm:px-6">
        {/* Brand */}
        <Link to="/dashboard" className="group flex min-w-0 items-center gap-2.5">
          {user?.organization?.logoUrl ? (
            <img
              src={user.organization.logoUrl}
              alt=""
              className="h-9 w-9 shrink-0 rounded-clay-sm object-cover shadow-clay-sm transition-transform duration-200 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-clay-sm bg-primary text-xs font-semibold text-primary-fg shadow-clay-sm transition-transform duration-200 group-hover:scale-105">
              {user?.organization?.name?.[0] || "F"}
            </div>
          )}
          <span className="hidden truncate font-semibold text-text md:inline">
            {user?.organization?.name || "FaceCheck-in"}
          </span>
        </Link>

        {/* Page links */}
        {links.length > 0 && (
          <div className="flex min-w-0 items-center gap-0.5 sm:gap-1">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className={navLinkClass} title={label} aria-label={label}>
                <Icon
                  aria-hidden="true"
                  className="text-xl transition-transform duration-200 group-hover:-translate-y-0.5"
                />
                <span className="hidden lg:inline">{label}</span>
              </NavLink>
            ))}
          </div>
        )}

        {/* Profile */}
        <button
          type="button"
          onClick={() => setShowAvatarModal(true)}
          className="flex shrink-0 items-center gap-2 rounded-full p-1 transition-colors duration-200 hover:bg-surface-raised sm:pr-3"
          aria-label="Open profile"
        >
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover shadow-clay-sm" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-raised text-xs font-semibold text-text shadow-clay-sm">
              {user?.name?.[0] || "?"}
            </div>
          )}
          <span className="hidden text-sm font-medium text-text sm:inline">{user?.name}</span>
        </button>
      </nav>

      {showAvatarModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={() => setShowAvatarModal(false)}
        >
          <div
            className="max-h-[90vh] w-full space-y-4 overflow-y-auto rounded-t-clay bg-surface p-6 shadow-clay sm:max-w-xs sm:rounded-clay"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-medium text-text">Profile</h3>
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
                className="w-full rounded-clay-sm px-3 py-2.5 text-sm font-medium text-danger shadow-clay-sm transition-shadow hover:bg-surface-raised disabled:opacity-50"
              >
                Remove picture
              </button>
            )}

            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm font-medium text-text">Appearance</span>
              <ThemeToggle />
            </div>

            {user?.role === "member" && (
              <button
                type="button"
                onClick={handleLeave}
                disabled={leaving}
                className="w-full rounded-clay-sm px-3 py-2.5 text-sm font-medium text-danger shadow-clay-sm transition-shadow hover:bg-surface-raised disabled:opacity-50"
              >
                {leaving ? "Leaving..." : "Leave organization"}
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