import { useState, useRef, useEffect, useCallback } from "react";
import axios from "axios";
import { MdKey, MdMeetingRoom, MdVideocam } from "react-icons/md";
import KioskNavbar from "../components/KioskNavbar";

const STORAGE_KEY = "facecheckin_kiosk_credentials";
const CAPTURE_INTERVAL_MS = 3000;
const RESULT_PAUSE_MS = 8000;

// Kiosk auth is header-based (org code + secret), not cookie/JWT-based, so
// this uses a plain axios instance rather than the shared axiosInstance —
// no withCredentials, no refresh-token interceptor, none of that applies here.
const kioskApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api/v1",
});

const Kiosk = () => {
  const [credentials, setCredentials] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  });
  const [orgCodeInput, setOrgCodeInput] = useState("");
  const [secretInput, setSecretInput] = useState("");
  const [orgInfo, setOrgInfo] = useState(null);

  const [status, setStatus] = useState("watching"); // "watching" | "processing" | "result"
  const [resultMessage, setResultMessage] = useState("");
  const [resultType, setResultType] = useState(""); // "success" | "error" | "warning"

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    if (!credentials) return;
    const startCamera = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    };
    startCamera();
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [credentials]);

  useEffect(() => {
    if (!credentials) return;
    kioskApi
      .get("/kiosk/info", {
        headers: { "X-Org-Code": credentials.orgCode, "X-Kiosk-Secret": credentials.secret },
      })
      .then(({ data }) => setOrgInfo(data.data.organization))
      .catch(() => setOrgInfo(null));
  }, [credentials]);

  const showResult = (message, type) => {
    pausedRef.current = true;
    setStatus("result");
    setResultMessage(message);
    setResultType(type);
    setTimeout(() => {
      pausedRef.current = false;
      setStatus("watching");
      setResultMessage("");
    }, RESULT_PAUSE_MS);
  };

  const captureAndRecognize = useCallback(async () => {
    if (pausedRef.current || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video.videoWidth) return; // camera not ready yet

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);

    canvas.toBlob(
      async (blob) => {
        if (!blob) return;
        const formData = new FormData();
        formData.append("image", blob, "capture.jpg");

        try {
          const { data } = await kioskApi.post("/kiosk/recognize", formData, {
            headers: {
              "X-Org-Code": credentials.orgCode,
              "X-Kiosk-Secret": credentials.secret,
            },
          });
          showResult(
            data.data.flagged
              ? `Welcome, ${data.data.name} (flagged for review)`
              : `Welcome, ${data.data.name}!`,
            "success"
          );
        } catch (err) {
          const statusCode = err.response?.status;
          const message = err.response?.data?.message || "";

          if (statusCode === 422 && message.includes("No face")) {
            return; // nobody in frame — stay silent, keep watching
          }
          if (statusCode === 404) {
            showResult("Face not recognized", "error");
          } else if (statusCode === 409) {
            showResult(message, "warning");
          } else if (statusCode === 400 && message.includes("Multiple")) {
            showResult("Multiple faces detected — one person at a time", "warning");
          } else {
            showResult("Could not process. Retrying...", "error");
          }
        }
      },
      "image/jpeg",
      0.9
    );
  }, [credentials]);

  useEffect(() => {
    if (!credentials) return;
    const interval = setInterval(captureAndRecognize, CAPTURE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [credentials, captureAndRecognize]);

  const handleSetup = (e) => {
    e.preventDefault();
    const creds = { orgCode: orgCodeInput.trim().toUpperCase(), secret: secretInput.trim() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
    setCredentials(creds);
  };

  const handleResetKiosk = () => {
    if (!window.confirm("Remove this device's kiosk setup?")) return;
    localStorage.removeItem(STORAGE_KEY);
    setCredentials(null);
  };

  if (!credentials) {
    return (
      <div className="min-h-screen bg-bg">
        <KioskNavbar setup />
        <div className="flex min-h-[calc(100vh-68px)] items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-5 clay-card">
          <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium text-primary">Device configuration</p><h1 className="mt-1 text-2xl font-semibold text-text">Kiosk setup</h1></div><div className="flex h-11 w-11 items-center justify-center rounded-clay-sm bg-surface-raised text-primary shadow-clay-inset"><MdVideocam aria-hidden="true" className="text-2xl" /></div></div>
          <p className="text-sm text-text-muted">
            Enter the credentials generated by your organization's admin to set up this device.
          </p>
          <form onSubmit={handleSetup} className="space-y-3">
            <label className="block text-sm font-medium text-text">Organization code<span className="relative mt-1 block"><MdMeetingRoom aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-text-muted" /><input type="text" placeholder="Organization code" value={orgCodeInput} onChange={(e) => setOrgCodeInput(e.target.value)} required className="clay-input pl-10" /></span></label>
            <label className="block text-sm font-medium text-text">Kiosk secret<span className="relative mt-1 block"><MdKey aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-text-muted" /><input type="text" placeholder="Kiosk secret" value={secretInput} onChange={(e) => setSecretInput(e.target.value)} required className="clay-input pl-10" /></span></label>
            <button type="submit" className="clay-btn-primary w-full"><MdVideocam aria-hidden="true" /> Activate kiosk</button>
          </form>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-black">
      <video ref={videoRef} autoPlay playsInline muted className="max-h-screen w-full object-cover" />
      <canvas ref={canvasRef} style={{ display: "none" }} />

      <KioskNavbar organization={orgInfo} organizationCode={credentials.orgCode} status={status} onReset={handleResetKiosk} />

      {status === "result" && (
        <div
          className={`absolute inset-x-0 bottom-0 p-6 text-center text-2xl font-semibold text-white ${
            resultType === "success"
              ? "bg-green-600/90"
              : resultType === "warning"
                ? "bg-amber-600/90"
                : "bg-red-600/90"
          }`}
        >
          {resultMessage}
        </div>
      )}
    </div>
  );
};

export default Kiosk;
