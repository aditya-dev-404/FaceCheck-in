import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import axiosInstance from "../api/axiosInstance";
import useAuth from "../hooks/useAuth";
import { MdAdd, MdBusiness, MdCheck, MdContentCopy, MdDeleteOutline, MdKey, MdSave, MdUpload } from "react-icons/md";

const ManageOrganization = () => {
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(""); // "", "saving", "success", "error"
  const [message, setMessage] = useState("");
  const [kioskSecret, setKioskSecret] = useState(null);
  const [kioskSecretCopied, setKioskSecretCopied] = useState(false);
  const [kioskError, setKioskError] = useState("");
  const [logoUrl, setLogoUrl] = useState(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState("");

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    const fetchOrg = async () => {
      try {
        const { data } = await axiosInstance.get("/organizations/me");
        setName(data.data.organization.name);
        setCode(data.data.organization.code);
        setCategories(data.data.organization.categories || []);
        setLogoUrl(data.data.organization.logoUrl || null);
      } finally {
        setLoading(false);
      }
    };
    fetchOrg();
  }, [user]);

  if (user && user.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  const handleAddCategory = () => {
    const trimmed = newCategory.trim();
    if (trimmed && !categories.includes(trimmed)) {
      setCategories([...categories, trimmed]);
    }
    setNewCategory("");
  };

  const handleRemoveCategory = (cat) => {
    setCategories(categories.filter((c) => c !== cat));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setStatus("saving");
    setMessage("");
    try {
      await axiosInstance.patch("/organizations/me", { name, code, categories });
      setStatus("success");
      setMessage("Organization updated");
    } catch (err) {
      setStatus("error");
      setMessage(err.response?.data?.message || "Could not update organization");
    }
  };

  const handleGenerateKioskCredentials = async () => {
    setKioskError("");
    const confirmed = window.confirm(
      "This will invalidate any previously configured kiosk device. Continue?"
    );
    if (!confirmed) return;
    try {
      const { data } = await axiosInstance.post("/organizations/me/kiosk-credentials");
      setKioskSecret(data.data.kioskSecret);
      setKioskSecretCopied(false);
    } catch (err) {
      setKioskError(err.response?.data?.message || "Could not generate kiosk credentials");
    }
  };

  const handleCopyKioskSecret = async () => {
    try {
      await navigator.clipboard.writeText(kioskSecret);
      setKioskSecretCopied(true);
    } catch {
      setKioskError("Could not copy the secret. Please copy it manually.");
    }
  };

  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoUploading(true);
    setLogoError("");
    const formData = new FormData();
    formData.append("logo", file);

    try {
      const { data } = await axiosInstance.post("/organizations/me/logo", formData);
      setLogoUrl(data.data.organization.logoUrl);
    } catch (err) {
      setLogoError(err.response?.data?.message || "Could not upload logo");
    } finally {
      setLogoUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    setLogoUploading(true);
    setLogoError("");
    try {
      await axiosInstance.delete("/organizations/me/logo");
      setLogoUrl(null);
    } catch (err) {
      setLogoError(err.response?.data?.message || "Could not remove logo");
    } finally {
      setLogoUploading(false);
    }
  };

  if (loading) return <p className="clay-page text-sm text-text-muted">Loading organization...</p>;

  return (
    <div className="clay-page max-w-3xl">
      <div className="clay-page-header"><div><p className="text-sm font-medium text-primary">Organization settings</p><h1 className="mt-1 text-2xl font-semibold text-text">Manage organization</h1></div><MdBusiness aria-hidden="true" className="text-4xl text-primary" /></div>

      <div className="clay-card space-y-4">
        <h2 className="text-lg font-semibold text-text">Organization logo</h2>
        <div className="flex items-center gap-4">
          {logoUrl ? (
            <img src={logoUrl} alt="Organization logo" className="h-16 w-16 rounded-clay-sm object-cover shadow-clay-sm" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-clay-sm bg-surface-raised text-xs text-text-muted shadow-clay-inset">
              No logo
            </div>
          )}
          <div className="space-y-2">
            <label className="clay-btn-primary inline-flex cursor-pointer">
              <MdUpload aria-hidden="true" />
              {logoUploading ? "Uploading..." : logoUrl ? "Replace Logo" : "Upload Logo"}
              <input type="file" accept="image/*" onChange={handleLogoChange} disabled={logoUploading} className="hidden" />
            </label>
            {logoUrl && (
              <button
                type="button"
                onClick={handleRemoveLogo}
                disabled={logoUploading}
                className="clay-action-danger ml-2"
              >
                <MdDeleteOutline aria-hidden="true" /> Remove
              </button>
            )}
          </div>
        </div>
        {logoError && <p className="text-sm text-danger">{logoError}</p>}
      </div>

      <form onSubmit={handleSave} className="clay-card space-y-4">
        <label className="block text-sm font-medium text-text">
          Organization name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="clay-input mt-1"
          />
        </label>

        <label className="block text-sm font-medium text-text">
          Organization code
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            className="clay-input mt-1"
          />
        </label>

        <div>
          <span className="block text-sm font-medium text-text">Categories</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {categories.map((cat) => (
              <span
                key={cat}
                className="flex items-center gap-1 rounded-full bg-surface-raised px-3 py-1 text-xs text-text shadow-clay-sm"
              >
                {cat}
                <button
                  type="button"
                  onClick={() => handleRemoveCategory(cat)}
                  className="text-text-muted hover:text-danger"
                  aria-label={`Remove ${cat}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              placeholder="New category"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddCategory();
                }
              }}
              className="clay-input flex-1"
            />
            <button
              type="button"
              onClick={handleAddCategory}
              className="clay-action"
            >
              <MdAdd aria-hidden="true" /> Add
            </button>
          </div>
        </div>

        {message && (
          <p className={`text-sm ${status === "error" ? "text-danger" : "text-success"}`}>{message}</p>
        )}

        <button
          type="submit"
          disabled={status === "saving"}
          className="clay-btn-primary w-full"
        >
          <MdSave aria-hidden="true" /> {status === "saving" ? "Saving..." : "Save changes"}
        </button>
      </form>

      <div className="clay-card space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-text">Kiosk setup</h2>
          <p className="mt-1 text-sm text-text-muted">
            Generate credentials for the physical attendance kiosk at your premises. Enter the
            organization code (<span className="font-mono">{code}</span>) and the secret below
            into the kiosk device's setup screen at <span className="font-mono">/kiosk</span>.
          </p>
        </div>

        {kioskSecret ? (
          <div className="space-y-2 rounded-clay-sm bg-surface-raised p-4 shadow-clay-inset">
            <p className="text-sm font-medium text-warning">
              Save this secret now — it will not be shown again.
            </p>
            <div className="flex items-start gap-2 rounded-clay-sm bg-bg p-3 shadow-clay-sm">
              <code className="min-w-0 flex-1 break-all text-xs text-text">{kioskSecret}</code>
              <button type="button" onClick={handleCopyKioskSecret} className="clay-action shrink-0 px-2.5 py-1.5 text-xs" aria-label="Copy kiosk secret">
                {kioskSecretCopied ? <MdCheck aria-hidden="true" /> : <MdContentCopy aria-hidden="true" />}
                {kioskSecretCopied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleGenerateKioskCredentials}
            className="clay-action"
          >
            <MdKey aria-hidden="true" /> Generate kiosk credentials
          </button>
        )}
        {kioskError && <p className="text-sm text-danger">{kioskError}</p>}
      </div>
    </div>
  );
};

export default ManageOrganization;
