import { useCallback, useEffect, useRef, useState } from "react";
import { MdHelpOutline, MdWarningAmber } from "react-icons/md";
import { ConfirmContext } from "./confirm-context";

/**
 * Replaces the browser's window.confirm with a dialog that matches the app.
 * Mount once near the root; call it anywhere through useConfirm().
 * Escape, clicking outside or Cancel resolve false; the confirm button
 * resolves true.
 */
export const ConfirmProvider = ({ children }) => {
  const [dialog, setDialog] = useState(null);
  const resolver = useRef(null);
  const confirmButtonRef = useRef(null);

  const confirm = useCallback((options = {}) => {
    // If one is somehow already open, dismiss it as "cancelled".
    resolver.current?.(false);

    return new Promise((resolve) => {
      resolver.current = resolve;
      setDialog({
        title: "Are you sure?",
        message: "",
        confirmText: "Confirm",
        cancelText: "Cancel",
        tone: "default",
        ...options,
      });
    });
  }, []);

  const close = useCallback((result) => {
    resolver.current?.(result);
    resolver.current = null;
    setDialog(null);
  }, []);

  useEffect(() => {
    if (!dialog) return;

    confirmButtonRef.current?.focus();
    const handleKeyDown = (e) => {
      if (e.key === "Escape") close(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [dialog, close]);

  const isDanger = dialog?.tone === "danger";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      {dialog && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={() => close(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-message"
            className="w-full space-y-5 rounded-t-clay bg-surface p-6 shadow-clay sm:max-w-sm sm:rounded-clay"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-clay-sm bg-surface-raised text-2xl shadow-clay-inset ${
                  isDanger ? "text-danger" : "text-primary"
                }`}
              >
                {isDanger ? <MdWarningAmber aria-hidden="true" /> : <MdHelpOutline aria-hidden="true" />}
              </span>
              <div className="min-w-0">
                <h3 id="confirm-title" className="text-base font-semibold text-text">
                  {dialog.title}
                </h3>
                {dialog.message && (
                  <p id="confirm-message" className="mt-1 text-sm text-text-muted">
                    {dialog.message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={() => close(false)} className="clay-btn-secondary flex-1">
                {dialog.cancelText}
              </button>
              <button
                ref={confirmButtonRef}
                type="button"
                onClick={() => close(true)}
                className={isDanger ? "clay-btn-secondary flex-1 font-semibold text-danger" : "clay-btn-primary flex-1"}
              >
                {dialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};