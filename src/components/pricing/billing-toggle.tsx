"use client";

import type { BillingPeriod } from "@/lib/pricing";

export function BillingToggle({
  period,
  onChange,
}: {
  period: BillingPeriod;
  onChange: (period: BillingPeriod) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-line bg-paper/70 p-1">
      <button
        type="button"
        onClick={() => onChange("monthly")}
        className={
          period === "monthly"
            ? "rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-paper"
            : "rounded-full px-4 py-1.5 text-sm font-medium text-ink/55 transition hover:text-ink"
        }
      >
        monthly
      </button>
      <button
        type="button"
        onClick={() => onChange("annual")}
        className={
          period === "annual"
            ? "rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-paper"
            : "rounded-full px-4 py-1.5 text-sm font-medium text-ink/55 transition hover:text-ink"
        }
      >
        annual
      </button>
      <span className="pr-3 pl-1 text-xs font-medium tracking-[-0.01em] text-ink/45">
        Save up to 17%
      </span>
    </div>
  );
}
