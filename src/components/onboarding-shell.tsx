import type { ReactNode } from "react";

import { Logo } from "@/components/logo";

const STEPS = ["Handle", "Discovery"] as const;

/** Shared frame for the post-sign-up flow: logo, step indicator, content. */
export function OnboardingShell({
  step,
  children,
}: {
  step: (typeof STEPS)[number];
  children: ReactNode;
}) {
  const current = STEPS.indexOf(step);

  return (
    <main className="relative flex min-h-full flex-1 flex-col overflow-hidden">
      <div
        aria-hidden
        className="dot-grid dot-grid-center pointer-events-none absolute inset-0 -z-10"
      />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <Logo />
          <ol
            aria-label="Onboarding progress"
            className="flex items-center gap-2 font-geist text-xs text-fg-3"
          >
            {STEPS.map((label, i) => (
              <li
                key={label}
                aria-current={i === current ? "step" : undefined}
                className={`flex items-center gap-2 ${i <= current ? "text-fg" : ""}`}
              >
                {i > 0 ? <span aria-hidden className="h-px w-4 bg-line" /> : null}
                <span
                  className={`grid size-5 place-items-center rounded-full border text-[0.7rem] ${
                    i <= current ? "border-ink bg-ink text-page" : "border-line"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </li>
            ))}
          </ol>
        </div>
        {children}
      </div>
    </main>
  );
}

/** Placeholder with the same footprint as the step content. */
export function OnboardingSkeleton() {
  return (
    <div className="mt-10 space-y-4" aria-hidden>
      <div className="h-10 w-3/4 animate-pulse rounded bg-ink/10" />
      <div className="h-5 w-full animate-pulse rounded bg-ink/10" />
      <div className="mt-8 h-12 w-full animate-pulse rounded-xl bg-ink/10" />
    </div>
  );
}
