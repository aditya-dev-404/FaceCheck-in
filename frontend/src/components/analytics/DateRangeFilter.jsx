import { useEffect, useState } from "react";

const PRESETS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function rangeForPreset(preset) {
  const to = new Date();
  const from = new Date(to.getTime() - preset.days * 24 * 60 * 60 * 1000);
  return { from: toISODate(from), to: toISODate(to) };
}

export default function DateRangeFilter({ onChange, defaultPreset = "90d" }) {
  const [active, setActive] = useState(defaultPreset);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  useEffect(() => {
    const initial = PRESETS.find((p) => p.label === defaultPreset) || PRESETS[2];
    onChange(rangeForPreset(initial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyPreset(preset) {
    setActive(preset.label);
    onChange(rangeForPreset(preset));
  }

  function applyCustom() {
    if (!customFrom || !customTo) return;
    setActive("custom");
    onChange({ from: customFrom, to: customTo });
  }

  return (
    <div className="clay-card flex flex-wrap items-center gap-2 py-3">
      {PRESETS.map((p) => (
        <button
          key={p.label}
          type="button"
          onClick={() => applyPreset(p)}
          className={`px-3 py-1.5 rounded-clay text-sm transition-shadow ${
            active === p.label ? "shadow-clay-inset text-primary" : "text-text-muted hover:text-text"
          }`}
        >
          {p.label}
        </button>
      ))}
      <div className="flex items-center gap-2 ml-2">
        <input
          type="date"
          value={customFrom}
          onChange={(e) => setCustomFrom(e.target.value)}
          className="rounded-clay bg-surface px-2 py-1 text-sm text-text shadow-clay-inset"
        />
        <span className="text-text-muted text-sm">to</span>
        <input
          type="date"
          value={customTo}
          onChange={(e) => setCustomTo(e.target.value)}
          className="rounded-clay bg-surface px-2 py-1 text-sm text-text shadow-clay-inset"
        />
        <button
          type="button"
          onClick={applyCustom}
          className={`px-3 py-1.5 rounded-clay text-sm transition-shadow ${
            active === "custom" ? "shadow-clay-inset text-primary" : "text-text-muted hover:text-text"
          }`}
        >
          Apply
        </button>
      </div>
    </div>
  );
}