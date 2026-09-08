import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import axiosInstance from "../api/axiosInstance";
import useAuth from "../hooks/useAuth";
import { MdEmail, MdLock, MdPersonAdd } from "react-icons/md";

/**
 * Admin-only: creates a member account directly (name/email/password),
 * skipping any self-registration. The member just logs in afterward and
 * does their one-time face enrollment themselves.
 */
const AddMember = () => {
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [category, setCategory] = useState("");
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
      const { data } = await axiosInstance.post("/users", { name, email, password, category });
      setStatus("success");
      setMessage(`${data.data.user.name} added. Share their email and password with them.`);
      setName("");
      setEmail("");
      setPassword("");
      setCategory("");
    } catch (err) {
      setStatus("error");
      setMessage(err.response?.data?.message || "Could not add member");
    }
  };

  return (
    <div className="clay-page max-w-2xl">
      <div className="clay-page-header"><div><p className="text-sm font-medium text-primary">Team management</p><h1 className="mt-1 text-2xl font-semibold text-text">Add a member</h1>
        <p className="mt-1 text-sm text-text-muted">
          Create a login for a member of your organization. They'll use this to log in and enroll their face.
        </p></div><MdPersonAdd aria-hidden="true" className="text-4xl text-primary" /></div>
      <form onSubmit={handleSubmit} className="clay-card space-y-4">
        <label className="block text-sm font-medium text-text">Full name<input type="text" placeholder="Member's full name" value={name} onChange={(e) => setName(e.target.value)} required className="clay-input mt-1" /></label>
        <label className="block text-sm font-medium text-text">Email address<span className="relative mt-1 block"><MdEmail aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-text-muted" /><input type="email" placeholder="member@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="clay-input pl-10" /></span></label>
        <label className="block text-sm font-medium text-text">Temporary password<span className="relative mt-1 block"><MdLock aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-text-muted" /><input type="password" placeholder="Temporary password" value={password} onChange={(e) => setPassword(e.target.value)} required className="clay-input pl-10" /></span></label>
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
