/**
 * Reusable webcam capture component. Shows a live video feed with a
 * "Capture" button; once captured, shows the still frame with a "Retake"
 * option. Calls onCapture(blob) with a JPEG blob when the user confirms.
 * Used by both the Enroll and Attendance pages.
 */
import { useCallback, useRef, useState, useEffect } from "react";
import { MdCameraAlt, MdCheck, MdRefresh, MdVideocam, MdWarningAmber } from "react-icons/md";

const CameraCapture = ({ onCapture }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [capturedImage, setCapturedImage] = useState(null);
  const [error, setError] = useState("");
  const [cameraState, setCameraState] = useState("requesting");

  const requestCamera = useCallback(async () => {
    setCameraState("requesting");
    setError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraState("ready");
    } catch (err) {
      setCameraState("error");
      setError(
        err.name === "NotAllowedError"
          ? "Camera access is blocked. Allow camera access in your browser settings, then try again."
          : "Could not access a camera. Check that a camera is connected and available."
      );
    }
  }, []);

  useEffect(() => {
    // Calling getUserMedia as soon as this screen opens triggers the browser
    // permission prompt whenever camera access has not yet been granted.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- required to request browser permission on screen entry
    requestCamera();

    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [requestCamera]);

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    setCapturedImage(canvas.toDataURL("image/jpeg"));
  };

  const handleRetake = () => {
    setCapturedImage(null);
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    canvas.toBlob(
      (blob) => {
        onCapture(blob);
      },
      "image/jpeg",
      0.9
    );
  };

  return (
    <div className="mx-auto w-full max-w-sm space-y-4 sm:max-w-md">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={cameraState === "ready" && !capturedImage ? "aspect-[3/4] w-full rounded-clay bg-black object-cover shadow-clay sm:aspect-video" : "hidden"}
      />
      {cameraState !== "ready" ? (
        <div className="clay-notice space-y-3 py-8 text-center">
          {cameraState === "requesting" ? (
            <MdVideocam aria-hidden="true" className="mx-auto text-3xl text-primary" />
          ) : (
            <MdWarningAmber aria-hidden="true" className="mx-auto text-3xl text-warning" />
          )}
          <div>
            <p className="font-medium text-text">
              {cameraState === "requesting" ? "Requesting camera access…" : "Camera access needed"}
            </p>
            {error && <p className="mt-1 text-sm text-danger">{error}</p>}
          </div>
          {cameraState === "error" && (
            <button type="button" onClick={requestCamera} className="clay-btn-primary">
              <MdVideocam aria-hidden="true" /> Try camera again
            </button>
          )}
        </div>
      ) : !capturedImage ? (
        <>
          <button type="button" onClick={handleCapture} className="clay-btn-primary w-full">
            <MdCameraAlt aria-hidden="true" /> Capture photo
          </button>
        </>
      ) : (
        <>
          <img
            src={capturedImage}
            alt="Captured face"
            className="aspect-[3/4] w-full rounded-clay object-cover shadow-clay sm:aspect-video"
          />
          <div className="flex gap-2">
            <button type="button" onClick={handleRetake} className="clay-btn-secondary flex-1">
              <MdRefresh aria-hidden="true" /> Retake
            </button>
            <button type="button" onClick={handleConfirm} className="clay-btn-primary flex-1">
              <MdCheck aria-hidden="true" /> Confirm
            </button>
          </div>
        </>
      )}
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
};

export default CameraCapture;
