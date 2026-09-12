import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { MdEmail, MdLock, MdLogin } from "react-icons/md";
import { MdVisibility, MdVisibilityOff } from "react-icons/md";
import useAuth from "../hooks/useAuth";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-68px)] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-5 clay-card">
        <div>
          <p className="text-sm font-medium text-primary">Welcome back</p>
          <h1 className="mt-1 text-2xl font-semibold text-text">Log in to FaceCheck-in</h1>
          <p className="mt-2 text-sm text-text-muted">Manage your organization and keep attendance moving.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-sm font-medium text-text">
            Email address
            <span className="relative mt-1 block">
              <MdEmail aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-text-muted" />
              <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="clay-input pl-10" />
            </span>
          </label>
          <label className="block text-sm font-medium text-text">
            Password
            <span className="relative mt-1 block">
              <MdLock aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-text-muted" />
              <input type={showPassword ? "text" : "password"} placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} required className="clay-input pl-10 pr-10" />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-lg text-text-muted"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <MdVisibilityOff aria-hidden="true" /> : <MdVisibility aria-hidden="true" />}
              </button>
            </span>
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button type="submit" disabled={submitting} className="clay-btn-primary w-full">
            <MdLogin aria-hidden="true" />
            {submitting ? "Logging in..." : "Log in"}
          </button>
        </form>
        <p className="text-center text-sm text-text-muted">
          <Link to="/forgot-password" className="text-primary hover:underline">
            Forgot your password?
          </Link>
        </p>
        <p className="border-t border-border pt-4 text-center text-sm text-text-muted">
          Setting up a new organization?{" "}
          <Link to="/register" className="text-primary hover:underline">
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
