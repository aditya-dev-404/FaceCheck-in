import { useState } from "react";
import { Link } from "react-router-dom";
import axiosInstance from "../api/axiosInstance";
import useAuth from "../hooks/useAuth";
import ThemeToggle from "./ThemeToggle"

const Navbar = () => {
  const { user, logout, refreshUser } = useAuth();
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

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

  return (
   <>
      <nav className="flex items-center justify-between bg-surface rounded-b-clay shadow-clay-sm px-4 sm:px-6 py-3">
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