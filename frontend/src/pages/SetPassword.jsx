import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { MdArrowBack, MdLock, MdPassword } from "react-icons/md";
import { MdVisibility, MdVisibilityOff } from "react-icons/md";
import axiosInstance from "../api/axiosInstance";

const SetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState(""); // "", "submitting", "success", "error"
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setStatus("error");
      setMessage("Passwords do not match");
      return;
    }

    setStatus("submitting");
    setMessage("");
    try {
      const { data } = await axiosInstance.post("/auth/set-password", { token, password });
      setStatus("success");
      setMessage(data.message);
      setTimeout(() => navigate("/login"), 500);
    } catch (err) {
      setStatus("error");
      setMessage(err.response?.data?.message || "Could not set password");
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-68px)] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-5 clay-card">
        <div><p className="text-sm font-medium text-primary">Welcome to FaceCheck-in</p><h1 className="mt-1 text-2xl font-semibold text-text">Set your password</h1><p className="mt-2 text-sm text-text-muted">Choose a password to activate your account.</p></div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-sm font-medium text-text">New password<span className="relative mt-1 block"><MdLock aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-text-muted" /><input type={showPassword ? "text" : "password"} placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} required className="clay-input pl-10 pr-10" /><button type="button" onClick={() => setShowPassword((prev) => !prev)} className="absolute right-3 top-1/2 -translate-y-1/2 text-lg text-text-muted" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <MdVisibilityOff aria-hidden="true" /> : <MdVisibility aria-hidden="true" />}</button></span></label>
          <label className="block text-sm font-medium text-text">Confirm new password<span className="relative mt-1 block"><MdLock aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-text-muted" /><input type={showConfirmPassword ? "text" : "password"} placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="clay-input pl-10 pr-10" /><button type="button" onClick={() => setShowConfirmPassword((prev) => !prev)} className="absolute right-3 top-1/2 -translate-y-1/2 text-lg text-text-muted" aria-label={showConfirmPassword ? "Hide password" : "Show password"}>{showConfirmPassword ? <MdVisibilityOff aria-hidden="true" /> : <MdVisibility aria-hidden="true" />}</button></span></label>
          {message && (
            <p className={`text-sm ${status === "error" ? "text-danger" : "text-success"}`}>{message}</p>
          )}
          <button type="submit" disabled={status === "submitting"} className="clay-btn-primary w-full"><MdPassword aria-hidden="true" />{status === "submitting" ? "Setting..." : "Set password"}</button>
        </form>
        <p className="text-center text-sm text-text-muted">
          <Link to="/login" className="inline-flex items-center gap-1 text-primary hover:underline">
            <MdArrowBack aria-hidden="true" /> Back to login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default SetPassword;

