import { useEffect, useState } from "react";
import { MdExpandLess, MdExpandMore, MdPersonAdd } from "react-icons/md";
import axiosInstance from "../api/axiosInstance";

const REASONS = {
  removed: "Removed by an admin",
  left: "Left the organization",
  switched: "Joined another organization",
  invite_cancelled: "Invite cancelled",
};

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }) : "—";

/**
 * Admin-only list of people who used to belong to this organization.
 * "Add back" sends them a fresh invite (same flow as Add Member by email);
 * they rejoin once they accept it.
 *
 * refreshKey: change it to make the list reload (e.g. the member count).
 * onChanged:  called after an Add back so the parent can reload its members.
 */
const RemovedMembers = ({ refreshKey, onChanged }) => {
  const [members, setMembers] = useState([]);
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    let cancelled = false;
    axiosInstance
      .get("/users/removed")
      .then(({ data }) => {
        if (!cancelled) setMembers(data.data.members);
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey, version]);

  const addBack = async (member) => {
    setBusyId(member._id);
    setMessage({ type: "", text: "" });
    try {
      const { data } = await axiosInstance.post("/users", {
        name: member.name,
        email: member.email,
        category: member.category || "",
      });
      setMessage({ type: "success", text: data.message });
      setVersion((v) => v + 1);
      onChanged?.();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Could not add member back" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-clay bg-surface shadow-clay-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span className="text-base font-semibold text-text">
          Removed members <span className="font-normal text-text-muted">({members.length})</span>
        </span>
        {open ? <MdExpandLess aria-hidden="true" className="text-xl text-text-muted" /> : <MdExpandMore aria-hidden="true" className="text-xl text-text-muted" />}
      </button>

      {open && (
        <div className="space-y-2 px-5 pb-5">
          {message.text && (
            <p className={`text-sm ${message.type === "error" ? "text-danger" : "text-success"}`}>{message.text}</p>
          )}

          {members.length === 0 ? (
            <p className="py-4 text-sm text-text-muted">
              Nobody has left or been removed. People you remove, or who leave on their own, show up here.
            </p>
          ) : (
            <ul className="space-y-2">
              {members.map((member) => (
                <li
                  key={member._id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-clay-sm bg-surface-raised px-4 py-3 shadow-clay-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text">{member.name}</p>
                    <p className="truncate text-xs text-text-muted">{member.email}</p>
                    <p className="mt-1 text-xs text-text-muted">
                      {REASONS[member.leftReason] || "No longer a member"} on {formatDate(member.leftAt)}
                      {member.category ? ` · ${member.category}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addBack(member)}
                    disabled={busyId === member._id}
                    className="clay-btn-primary px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    <MdPersonAdd aria-hidden="true" /> {busyId === member._id ? "Sending..." : "Add back"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default RemovedMembers;