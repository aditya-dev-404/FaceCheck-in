import { useState } from "react";
import { Link } from "react-router-dom";
import { MdArrowBack, MdEmail, MdSend } from "react-icons/md";
import axiosInstance from "../api/axiosInstance";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(""); // "", "submitting", "sent", "error"
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("submitting");
    setMessage("");
    try {
      const { data } = await axiosInstance.post("/auth/forgot-password", { email });
      setStatus("sent");
      setMessage(data.message);
    } catch (err) {
      setStatus("error");
      setMessage(err.response?.data?.message || "Something went wrong");
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-68px)] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-5 clay-card">
        <div>
          <p className="text-sm font-medium text-primary">Account recovery</p>
          <h1 className="mt-1 text-2xl font-semibold text-text">Forgot your password?</h1>
          <p className="mt-2 text-sm text-text-muted">
            Enter your email and we'll send you a link to reset your password.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-sm font-medium text-text">Email address<span className="relative mt-1 block"><MdEmail aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-text-muted" /><input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="clay-input pl-10" /></span></label>
          {message && (
            <p className={`text-sm ${status === "error" ? "text-danger" : "text-success"}`}>{message}</p>
          )}
          <button type="submit" disabled={status === "submitting"} className="clay-btn-primary w-full"><MdSend aria-hidden="true" />{status === "submitting" ? "Sending..." : "Send reset link"}</button>
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

export default ForgotPassword;
