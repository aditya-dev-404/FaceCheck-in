/**
 * Enrollment page: capture -> send to backend -> backend forwards to ML
 * service -> stores embedding. Uses CameraCapture for the capture step.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../api/axiosInstance";
import CameraCapture from "../components/CameraCapture";
import useAuth from "../hooks/useAuth";
import { MdFaceRetouchingNatural, MdInfo } from "react-icons/md";

const Enroll = () => {
  const [status, setStatus] = useState(""); // "", "submitting", "success", "error"
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const handleCapture = async (blob) => {
    setStatus("submitting");
    setMessage("");

    const formData = new FormData();
    formData.append("image", blob, "enroll.jpg");

    try {
      const { data } = await axiosInstance.post("/users/enroll", formData);
      setStatus("success");
      setMessage(data.message);
      await refreshUser();
      setTimeout(() => navigate("/dashboard"), 1200);
    } catch (err) {
      setStatus("error");
      setMessage(err.response?.data?.message || "Enrollment failed");
    }
  };

  return (
    <div className="clay-page max-w-2xl">
      <div className="clay-page-header">
        <div><p className="text-sm font-medium text-primary">One-time setup</p><h1 className="mt-1 text-2xl font-semibold text-text">Enroll your face</h1><p className="mt-2 text-sm text-text-muted">
          Look directly at the camera and make sure only your face is visible.
        </p></div>
        <MdFaceRetouchingNatural aria-hidden="true" className="text-4xl text-primary" />
      </div>
      <div className="clay-card p-4 sm:p-6">
        <CameraCapture onCapture={handleCapture} />
      </div>
      <p className="clay-notice flex items-center gap-2"><MdInfo aria-hidden="true" /> Your enrollment photo is used only to create a secure face embedding.</p>
      {status === "submitting" && <p className="text-sm text-text-muted">Enrolling...</p>}
      {status === "success" && <p className="text-sm text-success">{message}</p>}
      {status === "error" && <p className="text-sm text-danger">{message}</p>}
    </div>
  );
};

export default Enroll;
