import { useTheme } from "../hooks/useTheme";
import { MdOutlineDarkMode } from "react-icons/md";
import { MdOutlineLightMode } from "react-icons/md";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (<button
    type="button"
    onClick={toggleTheme}
    aria-label="Toggle dark mode"
    className="clay-toggle-track"
    style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
  >
    {/* Light Mode Icon (Left Side) */}
    <MdOutlineLightMode
      style={{
        position: "absolute",
        left: "6px",
        fontSize: "14px",
        color: isDark ? "#aaa" : "#f59e0b",
        transition: "color 0.2s ease"
      }}
    />

    {/* Dark Mode Icon (Right Side) */}
    <MdOutlineDarkMode
      style={{
        position: "absolute",
        right: "6px",
        fontSize: "14px",
        color: isDark ? "#38bdf8" : "#aaa",
        transition: "color 0.2s ease"
      }}
    />

    {/* Thumb with Active Icon */}
    <span
      className="clay-toggle-thumb"
      style={{
        transform: isDark ? "translateX(22px)" : "translateX(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1,
        transition: "transform 0.2s ease"
      }}
    >
      {isDark ? (
        <MdOutlineDarkMode style={{ fontSize: "12px", color: "#333" }} />
      ) : (
        <MdOutlineLightMode style={{ fontSize: "12px", color: "#333" }} />
      )}
    </span>
  </button>);
}