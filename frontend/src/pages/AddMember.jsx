import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import axiosInstance from "../api/axiosInstance";
import useAuth from "../hooks/useAuth";
import { MdEmail, MdPersonAdd, MdSchedule } from "react-icons/md";

/**
 * Admin-only: adds a member to the org. No password is collected here —
 * a new person gets a "set your password" email; an existing person gets
 * an invite email to accept using their existing account. Check-in time
 * and grace period (for late-entry tracking) are assigned here up front.
 */
const AddMember = () => {
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("");
  const [checkInTime, setCheckInTime] = useState("");
  const [gracePeriodMinutes, setGracePeriodMinutes] = useState(10);
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState(""); // "", "submitting", "success", "error"
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    const fetchCategories = async () => {
      try {
        const { data } = await axiosInstance.get("/organizations/me");
        setCategories(data.data.organization.categories || []);
      } catch {
        setCategories([]);
      }
    };
    fetchCategories();
  }, [user]);

  if (user && user.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("submitting");
    setMessage("");
    try {
      const { data } = await axiosInstance.post("/users", {
        name,
        email,
        category,
        checkInTime: checkInTime || null,
        gracePeriodMinutes,
      });
      setStatus("success");
      setMessage(data.message);
      setName("");
      setEmail("");
      setCategory("");
      setCheckInTime("");
      setGracePeriodMinutes(10);
    } catch (err) {
      setStatus("error");
      setMessage(err.response?.data?.message || "Could not add member");
    }
  };

  return (
    <div className="clay-page max-w-2xl">
      <div className="clay-page-header"><div><p className="text-sm font-medium text-primary">Team management</p><h1 className="mt-1 text-2xl font-semibold text-text">Add a member</h1>
        <p className="mt-1 text-sm text-text-muted">
          Add a member of your organization by email. They'll receive an email to set up their account.
        </p></div><MdPersonAdd aria-hidden="true" className="text-4xl text-primary" /></div>
      <form onSubmit={handleSubmit} className="clay-card space-y-4">
        <label className="block text-sm font-medium text-text">Full name<input type="text" placeholder="Member's full name" value={name} onChange={(e) => setName(e.target.value)} required className="clay-input mt-1" /></label>
        <label className="block text-sm font-medium text-text">Email address<span className="relative mt-1 block"><MdEmail aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-text-muted" /><input type="email" placeholder="member@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="clay-input pl-10" /></span></label>
        {categories.length > 0 && (
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="clay-select"
          >
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
        <div className="border-t border-border pt-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-medium text-text">
            <MdSchedule aria-hidden="true" className="text-lg text-primary" /> Check-in time {/*<span className="font-normal text-text-muted">(optional)</span>*/}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-text">
              Check-in time
              <input
                type="time"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                className="clay-input mt-1 w-full cursor-pointer [color-scheme:light]"
              />
            </label>
            <label className="block text-sm font-medium text-text">
              Grace period (minutes)
              <input
                type="number"
                min="0"
                value={gracePeriodMinutes}
                onChange={(e) => setGracePeriodMinutes(e.target.value)}
                className="clay-input mt-1"
              />
            </label>
          </div>
          <p className="mt-1 text-xs text-text-muted">Leave check-in time blank to skip late-entry tracking for this member. You can set it later from Manage Members.</p>
        </div>
        <button type="submit" disabled={status === "submitting"} className="clay-btn-primary w-full">
          <MdPersonAdd aria-hidden="true" /> {status === "submitting" ? "Adding..." : "Add member"}
        </button>
      </form>
      {message && (
        <p className={`text-sm ${status === "error" ? "text-danger" : "text-success"}`}>{message}</p>
      )}
    </div>
  );
};

export default AddMember;