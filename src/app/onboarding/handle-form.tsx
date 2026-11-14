"use client";

import { useActionState, useState } from "react";

import { HANDLE_ERROR_MESSAGES, HANDLE_MAX, normalizeHandleInput, validateHandle } from "@/lib/username";

import { type ClaimHandleState, claimHandle } from "./actions";

export function HandleForm({ urlPrefix }: { urlPrefix: string }) {
  const [state, formAction, pending] = useActionState<ClaimHandleState, FormData>(claimHandle, { handle: "" });
  const [value, setValue] = useState("");

  // The server's answer only applies to the value it was computed for.
  const serverError = state.handle === value ? state.error : undefined;
  const format = validateHandle(value);
  const liveError = value && format && format !== "reserved" ? HANDLE_ERROR_MESSAGES[format] : undefined;
  const error = serverError ?? liveError;

  return (
    <form action={formAction} className="mt-8 w-full" noValidate>
      <label htmlFor="handle" className="sr-only">
        Handle
      </label>
      <div
        className={`flex h-14 items-center rounded-xl border bg-card px-5 text-[19px] focus-within:border-ink/50 ${
          error ? "border-red-700/60" : "border-line"
        }`}
      >
        <span className="shrink-0 select-none text-fg-3">{urlPrefix}</span>
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
          enterKeyHint="go"
          placeholder="you"
          aria-invalid={Boolean(error)}
          aria-describedby="handle-help"
          className="min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-fg-3"
        />
      </div>
      <p id="handle-help" aria-live="polite" className={`mt-2 min-h-10 text-[14px] ${error ? "text-red-700" : "text-fg-3"}`}>
        {error ?? "Lowercase letters, numbers and hyphens. 3 to 39 characters."}
      </p>
      <button
        type="submit"
        disabled={pending || Boolean(liveError) || !value}
        className="btn-primary mt-2 h-14 w-full rounded-xl text-[17px] disabled:pointer-events-none disabled:opacity-50"
      >
        {pending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
