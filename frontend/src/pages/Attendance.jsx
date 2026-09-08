/**
 * Attendance marking page: capture -> send to backend -> backend runs
 * detect/embed/match/dedupe -> writes AttendanceRecord if matched.
 */
import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import axiosInstance from "../api/axiosInstance";
import CameraCapture from "../components/CameraCapture";
import useAuth from "../hooks/useAuth";
import { MdHowToReg, MdInfo } from "react-icons/md";

const Attendance = () => {
  const [status, setStatus] = useState(""); // "", "submitting", "success", "error"
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const { user } = useAuth();

  if (user && user.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  const handleCapture = async (blob) => {
    setStatus("submitting");
    setMessage("");

    const formData = new FormData();
    formData.append("image", blob, "attendance.jpg");

    try {
      const { data } = await axiosInstance.post("/attendance/mark", formData);
      setStatus("success");
      setMessage(data.message);
      setTimeout(() => navigate("/dashboard"), 1200);
    } catch (err) {
      setStatus("error");
      setMessage(err.response?.data?.message || "Could not mark attendance");
    }
  };

  return (
    <div className="clay-page max-w-2xl">
      <div className="clay-page-header"><div><p className="text-sm font-medium text-primary">Admin fallback</p><h1 className="mt-1 text-2xl font-semibold text-text">Mark attendance</h1><p className="mt-2 text-sm text-text-muted">
          Manual entry for when the kiosk is unavailable. Look directly at the camera.
        </p></div><MdHowToReg aria-hidden="true" className="text-4xl text-primary" /></div>
      <div className="clay-card p-4 sm:p-6">
        <CameraCapture onCapture={handleCapture} />
      </div>
      <p className="clay-notice flex items-center gap-2"><MdInfo aria-hidden="true" /> Use this only when the regular kiosk is unavailable.</p>
      {status === "submitting" && <p className="text-sm text-text-muted">Verifying...</p>}
      {status === "success" && <p className="text-sm text-success">{message}</p>}
      {status === "error" && <p className="text-sm text-danger">{message}</p>}
    </div>
  );
};

export default Attendance;
