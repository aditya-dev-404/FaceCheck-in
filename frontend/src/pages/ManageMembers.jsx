import { useState, useEffect, useRef } from "react";
import { Navigate, Link } from "react-router-dom";
import axiosInstance from "../api/axiosInstance";
import useAuth from "../hooks/useAuth";
import { MdAdd, MdCancel, MdCheck, MdDeleteOutline, MdEdit, MdFlag, MdGroup, MdMoreVert, MdPersonOff, MdPersonOutline } from "react-icons/md";

const ManageMembers = () => {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", category: "", checkInTime: "", gracePeriodMinutes: 10 });
  const [error, setError] = useState("");
  const [viewingMember, setViewingMember] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);

  const fetchMembers = async () => {
    try {
      const { data } = await axiosInstance.get("/users");
      setMembers(data.data.members);
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount pattern, no race condition
    fetchMembers();
    axiosInstance
      .get("/organizations/me")
      .then(({ data }) => setCategories(data.data.organization.categories || []))
      .catch(() => setCategories([]));
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (user && user.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  const startEdit = (member) => {
    setEditingId(member._id);
    setEditForm({
      name: member.name,
      email: member.email,
      category: member.category || "",
      checkInTime: member.checkInTime || "",
      gracePeriodMinutes: member.gracePeriodMinutes ?? 10,
    });
    setError("");
    setOpenMenuId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setError("");
  };

  const saveEdit = async (id) => {
    setError("");
    try {
      await axiosInstance.patch(`/users/${id}`, {
        ...editForm,
        checkInTime: editForm.checkInTime || null,
        gracePeriodMinutes: Number(editForm.gracePeriodMinutes),
      });
      setEditingId(null);
      fetchMembers();
    } catch (err) {
      setError(err.response?.data?.message || "Could not update member");
    }
  };

  const toggleActive = async (member) => {
    setOpenMenuId(null);
    const action = member.isActive ? "deactivate" : "activate";
    await axiosInstance.patch(`/users/${member._id}/${action}`);
    fetchMembers();
  };

  const removeMember = async (member) => {
    setOpenMenuId(null);
    if (!window.confirm(`Permanently remove ${member.name}? This cannot be undone.`)) return;
    await axiosInstance.delete(`/users/${member._id}`);
    fetchMembers();
  };

  const unflagMember = async (member) => {
    setOpenMenuId(null);
    await axiosInstance.patch(`/users/${member._id}/unflag`);
    fetchMembers();
  };

  const deleteFlagImage = async (member) => {
    if (!window.confirm("Delete this flagged image? The member will remain flagged.")) return;
    await axiosInstance.delete(`/users/${member._id}/flag-image`);
    setViewingMember(null);
    fetchMembers();
  };

  if (loading) return <p className="clay-page text-sm text-text-muted">Loading members...</p>;

  return (
    <div className="clay-page pb-40">
      <div className="clay-page-header">
        <div>
          <p className="text-sm font-medium text-primary">Team management</p>
          <h1 className="mt-1 text-2xl font-semibold text-text">Manage members</h1>
        </div>
        <Link to="/add-member" className="clay-btn-primary">
          <MdAdd aria-hidden="true" /> Add member
        </Link>
      </div>

      <div className="rounded-clay bg-surface shadow-clay-sm">
        <div className="overflow-x-auto min-h-[300px] rounded-clay">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-surface-raised text-left text-xs font-medium uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Check-in</th>
                <th className="px-4 py-3">Enrolled</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 w-12 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-text-muted">
                    <MdGroup aria-hidden="true" className="mx-auto mb-2 text-3xl text-primary" />
                    No members yet.
                  </td>
                </tr>
              ) : (
                members.map((member) => (
                  <tr key={member._id} className={!member.isActive || member.isFlagged ? "bg-surface-raised" : ""}>
                    {editingId === member._id ? (
                      <>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="clay-input py-1"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="email"
                            value={editForm.email}
                            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                            className="clay-input py-1"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <select
                            value={editForm.category}
                            onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                            className="clay-select py-1"
                          >
                            <option value="">No category</option>
                            {categories.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex flex-col gap-1">
                            <input
                              type="time"
                              value={editForm.checkInTime}
                              onChange={(e) => setEditForm({ ...editForm, checkInTime: e.target.value })}
                              className="clay-input py-1"
                            />
                            <input
                              type="number"
                              min="0"
                              value={editForm.gracePeriodMinutes}
                              onChange={(e) => setEditForm({ ...editForm, gracePeriodMinutes: e.target.value })}
                              className="clay-input py-1"
                              title="Grace period (minutes)"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-2 text-text-muted">—</td>
                        <td className="px-4 py-2 text-text-muted">—</td>
                        <td className="px-4 py-2">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => saveEdit(member._id)}
                              className="clay-btn-primary px-2.5 py-1.5 text-xs"
                            >
                              <MdCheck aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="clay-action px-2.5 py-1.5 text-xs"
                            >
                              <MdCancel aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-medium text-text">
                          {member.name}
                          {member.isFlagged && (
                            <button
                              type="button"
                              onClick={() => setViewingMember(member)}
                              className="ml-2 inline-flex items-center gap-1 rounded-full bg-surface-raised px-2 py-0.5 text-xs font-medium text-danger shadow-clay-sm"
                              title={member.flagReason || "Flagged for review"}
                            >
                              <MdFlag aria-hidden="true" /> Flagged
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-text-muted">{member.email}</td>
                        <td className="px-4 py-3 text-text-muted">{member.category || "—"}</td>
                        <td className="px-4 py-3 text-text-muted">{member.checkInTime || "—"}</td>
                        <td className="px-4 py-2">
                          <span className={`clay-badge ${member.isEnrolled ? "text-success" : ""}`}>
                            {member.isEnrolled ? "Enrolled" : "Pending"}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              member.isActive ? "bg-surface-raised text-success shadow-clay-sm" : "bg-surface-raised text-text-muted shadow-clay-sm"
                            }`}
                          >
                            {member.isActive ? "Active" : "Deactivated"}
                          </span>
                        </td>
                        <td className="relative px-4 py-2 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(openMenuId === member._id ? null : member._id);
                            }}
                            className="clay-action rounded-full p-1.5 inline-flex items-center justify-center"
                            aria-label="Actions"
                          >
                            <MdMoreVert aria-hidden="true" className="text-lg" />
                          </button>
                          {openMenuId === member._id && (
                            <div
                              ref={menuRef}
                              className="absolute right-4 top-12 z-50 w-40 rounded-clay-sm bg-surface py-1 text-left shadow-lg ring-1 ring-black/10 border border-border"
                            >
                              <button
                                type="button"
                                onClick={() => startEdit(member)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text hover:bg-surface-raised"
                              >
                                <MdEdit aria-hidden="true" /> Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleActive(member)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text hover:bg-surface-raised"
                              >
                                {member.isActive ? <MdPersonOff aria-hidden="true" /> : <MdPersonOutline aria-hidden="true" />}
                                {member.isActive ? "Deactivate" : "Activate"}
                              </button>
                              {member.isFlagged && (
                                <button
                                  type="button"
                                  onClick={() => unflagMember(member)}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-danger hover:bg-surface-raised"
                                >
                                  <MdFlag aria-hidden="true" /> Unflag
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => removeMember(member)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-danger hover:bg-surface-raised"
                              >
                                <MdDeleteOutline aria-hidden="true" /> Remove
                              </button>
                            </div>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      {viewingMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setViewingMember(null)}
        >
          <div
            className="w-full max-w-md space-y-4 rounded-clay bg-surface p-6 shadow-clay"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-lg font-semibold text-text">{viewingMember.name} — Flagged review</h3>
              <p className="mt-1 text-sm text-text-muted">{viewingMember.flagReason}</p>
            </div>

            {viewingMember.flaggedImageUrl ? (
              <img
                src={viewingMember.flaggedImageUrl}
                alt={`Flagged capture of ${viewingMember.name}`}
                className="w-full rounded-md border border-gray-200"
              />
            ) : (
              <p className="rounded-md bg-gray-50 p-4 text-center text-sm text-gray-500">
                No image available for this flag.
              </p>
            )}

            <div className="flex justify-end gap-2">
              {viewingMember.flaggedImageUrl && (
                <button
                  type="button"
                  onClick={() => deleteFlagImage(viewingMember)}
                  className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Delete Image
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewingMember(null)}
                className="rounded-md bg-gray-800 px-3 py-2 text-sm font-medium text-white hover:bg-gray-900"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageMembers;