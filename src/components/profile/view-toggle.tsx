"use client";

import { useState, type ReactNode } from "react";

/**
 * Recruiter view by default; the developer view reveals technical detail
 * (dependencies, language breakdown) for the engineer the recruiter forwards it to.
 */
export function ViewToggle({ children }: { children: ReactNode }) {
  const [view, setView] = useState<"recruiter" | "developer">("recruiter");
  return (
    <div data-view={view} className="group/view">
      <div role="tablist" aria-label="Profile view" className="mb-8 inline-flex rounded-xl border border-line bg-panel p-1">
        {(["recruiter", "developer"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={`rounded-lg px-3.5 py-1.5 text-[14px] transition-colors ${
              view === v ? "bg-card font-medium text-fg shadow-sm" : "text-fg-2 hover:text-fg"
            }`}
          >
            {v === "recruiter" ? "Recruiter view" : "Developer view"}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}
