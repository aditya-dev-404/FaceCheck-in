import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { MdBusiness, MdEmail, MdLock, MdPerson, MdPersonAdd } from "react-icons/md";
import useAuth from "../hooks/useAuth";

/**
 * This is admin-only self-signup: creates a brand-new Organization plus
 * the first admin account for it. Regular members never see this page —
 * they're added by an admin via the Add Member page and just log in.
 */
const Register = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [organizationCode, setOrganizationCode] = useState("");
  const [categoriesInput, setCategoriesInput] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const categories = categoriesInput
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    try {
      await register({ name, email, password, organizationName, organizationCode, categories });
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-68px)] items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl space-y-5 clay-card">
        <div>
          <p className="text-sm font-medium text-primary">Get started</p>
          <h1 className="mt-1 text-2xl font-semibold text-text">Register your organization</h1>
          <p className="mt-2 text-sm text-text-muted">
            This creates your organization and your admin account. Members are added by you afterward.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-text">Organization name<span className="relative mt-1 block"><MdBusiness aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-text-muted" /><input type="text" placeholder="Acme Inc." value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} required className="clay-input pl-10" /></span></label>
            <label className="block text-sm font-medium text-text">Organization code<input type="text" placeholder="e.g. ACME2026" value={organizationCode} onChange={(e) => setOrganizationCode(e.target.value)} required className="clay-input mt-1" /></label>
          </div>
          <label className="block text-sm font-medium text-text">Categories <span className="font-normal text-text-muted">(optional)</span><input type="text" placeholder="Student, Teacher, Staff" value={categoriesInput} onChange={(e) => setCategoriesInput(e.target.value)} className="clay-input mt-1" /><span className="mt-1 block text-xs font-normal text-text-muted">Separate categories with commas. You can edit them later.</span></label>
          <div className="border-t border-border pt-4"><p className="mb-3 text-sm font-medium text-text">Your admin account</p><div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-medium text-text">Full name<span className="relative mt-1 block"><MdPerson aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-text-muted" /><input type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required className="clay-input pl-10" /></span></label><label className="block text-sm font-medium text-text">Email address<span className="relative mt-1 block"><MdEmail aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-text-muted" /><input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="clay-input pl-10" /></span></label></div><label className="mt-3 block text-sm font-medium text-text">Password<span className="relative mt-1 block"><MdLock aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-text-muted" /><input type="password" placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} required className="clay-input pl-10" /></span></label></div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button type="submit" disabled={submitting} className="clay-btn-primary w-full"><MdPersonAdd aria-hidden="true" />{submitting ? "Creating..." : "Create organization"}</button>
        </form>
        <p className="text-center text-sm text-text-muted">
          Already have an account?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
