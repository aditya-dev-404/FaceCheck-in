import { useState, useRef, useEffect, useCallback } from "react";
import axios from "axios";
import { MdKey, MdMeetingRoom, MdVideocam } from "react-icons/md";
import KioskNavbar from "../components/KioskNavbar";

const STORAGE_KEY = "facecheckin_kiosk_credentials";
const CAPTURE_INTERVAL_MS = 3000;

const kioskApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api/v1",
});

const statusStyles = {
  marked: "bg-green-600/90",
  flagged: "bg-amber-600/90",
  "already-marked": "bg-amber-600/90",
  "not-recognized": "bg-red-600/90",
};

const statusLabel = (r) => {
  switch (r.status) {
    case "marked":
      return `Welcome, ${r.name}!`;
    case "flagged":
      return `Welcome, ${r.name} (flagged for review)`;
    case "already-marked":
      return `${r.name} — already marked today`;
    case "not-recognized":
      return "Face not recognized";
    default:
      return "";
  }
};

const Kiosk = () => {
  const [credentials, setCredentials] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  });
  const [orgCodeInput, setOrgCodeInput] = useState("");
  const [secretInput, setSecretInput] = useState("");
  const [orgInfo, setOrgInfo] = useState(null);

  const [status, setStatus] = useState("watching"); // "watching" | "result"
  const [results, setResults] = useState([]);
  const [skippedCount, setSkippedCount] = useState(0);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const processingRef = useRef(false);

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

  const captureAndRecognize = useCallback(async () => {
    if (processingRef.current || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video.videoWidth) return; // camera not ready yet

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);

    canvas.toBlob(
      async (blob) => {
        if (!blob) return;
        processingRef.current = true;
        const formData = new FormData();
        formData.append("image", blob, "capture.jpg");

        try {
          const { data } = await kioskApi.post("/kiosk/recognize", formData, {
            headers: {
              "X-Org-Code": credentials.orgCode,
              "X-Kiosk-Secret": credentials.secret,
            },
          });
          setResults(data.data.results);
          setSkippedCount(data.data.skippedCount || 0);
          setStatus("result");
        } catch (err) {
          const statusCode = err.response?.status;
          const message = err.response?.data?.message || "";

          if (statusCode === 422 && message.includes("No face")) {
            setStatus("watching"); // nobody in frame — stay silent, keep watching
          } else {
            setResults([{ status: "not-recognized", name: "Could not process. Retrying..." }]);
            setStatus("result");
          }
        } finally {
          processingRef.current = false;
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

      {status === "result" && results.length > 0 && (
        <div className="absolute inset-x-0 bottom-0 max-h-[50vh] overflow-y-auto p-4 space-y-2">
          {results.map((r, i) => (
            <div
              key={i}
              className={`rounded-clay-sm p-4 text-center text-lg font-semibold text-white ${statusStyles[r.status] || "bg-red-600/90"}`}
            >
              {statusLabel(r)}
            </div>
          ))}
          {skippedCount > 0 && (
            <div className="rounded-clay-sm bg-black/70 p-3 text-center text-sm text-white">
              {skippedCount} more face{skippedCount > 1 ? "s" : ""} detected but not processed — please check in again
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Kiosk;