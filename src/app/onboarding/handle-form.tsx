"use client";

import { useActionState, useState } from "react";

import { ArrowRight } from "@/components/icons";
import {
  HANDLE_ERROR_MESSAGES,
  HANDLE_MAX,
  normalizeHandleInput,
  validateHandle,
} from "@/lib/username";

import { type ClaimHandleState, claimHandle } from "./actions";

export function HandleForm({
  initialState,
  urlPrefix,
}: {
  initialState: ClaimHandleState;
  /** e.g. "rows.so/u/" */
  urlPrefix: string;
}) {
  const [state, formAction, pending] = useActionState(claimHandle, initialState);
  const [value, setValue] = useState(initialState.handle);
  // The server result is only relevant to the value it was computed for.
  const serverError = state.handle === value ? state.error : undefined;
  const suggestion = state.handle === value ? state.suggestion : undefined;

  // Instant format hint while typing; availability is checked on submit.
  const formatError = validateHandle(value);
  const liveError =
    value && formatError && formatError !== "reserved"
      ? HANDLE_ERROR_MESSAGES[formatError]
      : undefined;
  const error = serverError ?? liveError;

  return (
    <form action={formAction} className="mt-8" noValidate>
      <label htmlFor="handle" className="text-sm font-medium text-fg">
        Your handle
      </label>
      <div
        className={`mt-2 flex h-12 items-center rounded-xl border bg-card px-4 font-geist text-[0.95rem] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus-within:border-ink/40 ${
          error ? "border-red-700/50" : "border-line"
        }`}
      >
        <span className="shrink-0 text-fg-3 select-none">{urlPrefix}</span>
        <input
          id="handle"
          name="handle"
          value={value}
          onChange={(e) => setValue(normalizeHandleInput(e.target.value))}
          maxLength={HANDLE_MAX}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          aria-invalid={Boolean(error)}
          aria-describedby="handle-help"
          className="min-w-0 flex-1 bg-transparent text-fg outline-none"
        />
      </div>

      <div id="handle-help" aria-live="polite" className="mt-2 min-h-12 text-sm">
        {error ? (
          <p className="text-red-700" role="alert">
            {error}
            {suggestion ? (
              <>
                {" "}
                Try{" "}
                <button
                  type="button"
                  onClick={() => setValue(suggestion)}
                  className="font-medium text-fg underline underline-offset-4 hover:no-underline"
                >
                  {suggestion}
                </button>
                .
              </>
            ) : null}
          </p>
        ) : (
          <p className="text-fg-3">
            Your public address on Rows. Lowercase letters, numbers and hyphens.
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending || Boolean(liveError) || !value}
        className="btn-primary group mt-4 h-12 w-full rounded-xl px-5 text-[0.95rem] disabled:pointer-events-none disabled:opacity-50"
      >
        <span>{pending ? "Saving…" : "Continue"}</span>
        {pending ? null : (
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        )}
      </button>
    </form>
  );
}
