import { useState } from "react";

export default function ExpandableSummaryCard({ title, text }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="clay-card flex flex-col">
      <h4 className="font-medium text-text mb-2">{title}</h4>
      <p
        className="text-sm text-text-muted leading-relaxed overflow-hidden"
        style={{ maxHeight: expanded ? "none" : "150px" }}
      >
        {text}
      </p>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="mt-2 self-start text-xs font-medium text-primary hover:underline"
      >
        {expanded ? "Show less" : "Read more"}
      </button>
    </div>
  );
}