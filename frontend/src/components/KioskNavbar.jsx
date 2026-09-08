import { MdFaceRetouchingNatural, MdRefresh, MdVideocam } from "react-icons/md";
import ThemeToggle from "./ThemeToggle";

export default function KioskNavbar({ organization, organizationCode, status, onReset, setup = false }) {
  const organizationName = organization?.name || (setup ? "FaceCheck-in" : organizationCode || "FaceCheck-in");

  return (
    <nav className={setup ? "mx-auto flex max-w-5xl items-center justify-between rounded-b-clay bg-surface px-4 py-3 shadow-clay-sm sm:px-6" : "absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-black/35 px-4 py-3 backdrop-blur-sm sm:px-6"}>
      <div className="flex min-w-0 items-center gap-3">
        {organization?.logoUrl ? (
          <img src={organization.logoUrl} alt="" className="h-10 w-10 shrink-0 rounded-clay-sm object-cover shadow-clay-sm" />
        ) : (
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-clay-sm shadow-clay-sm ${setup ? "bg-primary text-primary-fg" : "bg-surface text-primary"}`}>
            <MdFaceRetouchingNatural aria-hidden="true" className="text-xl" />
          </div>
        )}
        <div className="min-w-0">
          <p className={`truncate text-sm font-semibold ${setup ? "text-text" : "text-white"}`}>{organizationName}</p>
          <p className={`flex items-center gap-1 text-xs ${setup ? "text-text-muted" : "text-white/75"}`}><MdVideocam aria-hidden="true" /> Attendance kiosk</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <ThemeToggle />
        {!setup && (
          <>
          <span className="hidden rounded-full bg-black/30 px-3 py-1 text-xs font-medium text-white sm:inline">
            {status === "watching" ? "Ready to check in" : "Processing"}
          </span>
          <button type="button" onClick={onReset} className="inline-flex items-center gap-1 rounded-clay-sm bg-black/30 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-black/50">
            <MdRefresh aria-hidden="true" /> Reset
          </button>
          </>
        )}
      </div>
    </nav>
  );
}
