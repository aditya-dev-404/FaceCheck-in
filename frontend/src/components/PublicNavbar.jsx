import { Link } from "react-router-dom";
import { MdArrowForward, MdFaceRetouchingNatural, MdLogin } from "react-icons/md";
import ThemeToggle from "./ThemeToggle";

export default function PublicNavbar() {
  return (
    <nav className="mx-auto flex max-w-7xl items-center justify-between rounded-b-clay bg-surface px-4 py-3 shadow-clay-sm sm:px-6">
      <Link to="/" className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-clay-sm bg-primary text-primary-fg shadow-clay-sm">
          <MdFaceRetouchingNatural aria-hidden="true" className="text-xl" />
        </div>
        <span className="font-semibold text-text">FaceCheck-in</span>
      </Link>

      <div className="flex items-center gap-2 sm:gap-4">
        <ThemeToggle />
        <Link to="/login" className="hidden items-center gap-1 text-sm font-medium text-text transition-colors hover:text-primary sm:inline-flex">
          <MdLogin aria-hidden="true" />
          Log in
        </Link>
        <Link to="/register" className="clay-btn-primary px-4 py-2 text-sm">
          Get started
          <MdArrowForward aria-hidden="true" />
        </Link>
      </div>
    </nav>
  );
}
