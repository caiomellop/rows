"use client";

import { useState, useTransition, type ReactNode } from "react";

import type { ActionResult } from "@/app/dashboard/actions";

/** A button that runs a Server Action and reports its result inline. */
export function ActionButton({
  action,
  children,
  pendingLabel,
  className = "btn-secondary h-9 rounded-lg px-3.5 text-[14px]",
  confirm,
  showMessage = true,
}: {
  action: () => Promise<ActionResult>;
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
  confirm?: string;
  showMessage?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          startTransition(async () => {
            try {
              setResult(await action());
            } catch {
              setResult({ ok: false, error: "Something went wrong. Refresh and try again." });
            }
          });
        }}
      >
        {pending ? (pendingLabel ?? children) : children}
      </button>
      {result && !result.ok ? (
        <span role="alert" className="text-[13px] text-red-700">
          {result.error}
        </span>
      ) : result?.ok && result.message && showMessage ? (
        <span role="status" className="text-[13px] text-fg-3">
          {result.message}
        </span>
      ) : null}
    </span>
  );
}

export function FormStatus({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  return state.ok ? (
    state.message ? (
      <p role="status" className="text-[13px] text-fg-3">
        {state.message}
      </p>
    ) : null
  ) : (
    <p role="alert" className="text-[13px] text-red-700">
      {state.error}
    </p>
  );
}
