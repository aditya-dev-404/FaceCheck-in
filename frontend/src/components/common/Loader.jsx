/**
 * Claymorphic loading spinner. Inline usage: a comet-trail marble orbiting
 * a clay groove, sized via `size`. Full-page usage (`fullPage`): a centered
 * splash overlay with a soft glowing halo behind a larger spinner and the
 * app name, for use whenever an entire page/route is loading.
 *
 * The animation is driven entirely by inline style + its own injected
 * @keyframes (below), rather than Tailwind's animate-spin/animate-pulse
 * utility classes — keeps it working regardless of how a given build scans
 * this file for Tailwind classes, and avoids relying on overriding a
 * shorthand `animation` (set by a utility class) with a longhand inline
 * `animationDuration`, which some browsers/build setups don't reconcile
 * the way you'd expect.
 */
const SIZE_MAP = {
  sm: { box: 22, knob: 6 },
  md: { box: 44, knob: 10 },
  lg: { box: 72, knob: 15 },
  xl: { box: 108, knob: 22 },
  hero: { box: 140, knob: 26 },
};

const KEYFRAMES = `
@keyframes clay-loader-spin {
  to { transform: rotate(360deg); }
}
@keyframes clay-loader-pulse {
  0%, 100% { opacity: 0.35; transform: scale(0.92); }
  50% { opacity: 0.7; transform: scale(1.05); }
}
`;

function OrbitSpinner({ size = "md" }) {
  const { box, knob } = SIZE_MAP[size] || SIZE_MAP.md;
  const radius = box / 2 - knob / 2;
  // A short comet trail: the lead dot plus two fading, shrinking dots
  // just behind it, all fixed at these angles so the whole thing reads
  // as a trail once the wrapper spins.
  const trail = [
    { angle: 0, scale: 1, opacity: 1 },
    { angle: -30, scale: 0.72, opacity: 0.5 },
    { angle: -58, scale: 0.48, opacity: 0.22 },
  ];

  return (
    <div
      className="relative motion-reduce:!animate-none"
      style={{
        width: box,
        height: box,
        animation: "clay-loader-spin 1.15s linear infinite",
      }}
    >
      <div className="absolute inset-0 rounded-full bg-surface shadow-clay-inset" />
      {trail.map(({ angle, scale, opacity }, i) => {
        const dot = knob * scale;
        return (
          <div
            key={i}
            className="absolute rounded-full bg-primary shadow-clay"
            style={{
              width: dot,
              height: dot,
              top: box / 2 - dot / 2,
              left: box / 2 - dot / 2,
              opacity,
              transform: `rotate(${angle}deg) translateY(-${radius}px)`,
            }}
          />
        );
      })}
    </div>
  );
}

export default function Loader({ size = "md", label, className = "", fullPage = false }) {
  const inline = (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <style>{KEYFRAMES}</style>
      <OrbitSpinner size={size} />
      {label && <p className="text-xs text-text-muted">{label}</p>}
    </div>
  );

  if (!fullPage) return inline;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/90 backdrop-blur-sm">
      <style>{KEYFRAMES}</style>
      <div className="flex flex-col items-center gap-5">
        <div className="relative flex items-center justify-center">
          <span
            className="absolute h-40 w-40 rounded-full bg-primary/10 motion-reduce:!animate-none"
            style={{ animation: "clay-loader-pulse 2.4s ease-in-out infinite" }}
          />
          <OrbitSpinner size="hero" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-base font-semibold tracking-wide text-text">FaceCheck-in</p>
          <p className="text-xs text-text-muted">{label || "Loading..."}</p>
        </div>
      </div>
    </div>
  );
}