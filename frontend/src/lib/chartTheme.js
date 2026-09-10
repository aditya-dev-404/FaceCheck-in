export function getChartColors(theme) {
  return theme === "dark"
    ? { primary: "#57B67B", muted: "#9AB09F", grid: "#24352B", text: "#E6F0E8", danger: "#D9705C" }
    : { primary: "#3F7A52", muted: "#5B6C60", grid: "#C9D9C7", text: "#1E2B22", danger: "#B3432F" };
}