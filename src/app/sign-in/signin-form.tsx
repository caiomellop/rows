"use client";

import { useActionState } from "react";

import { LOGIN_LINK_TTL_MINUTES } from "@/lib/login-token";

import { type SignInState, requestLink } from "./actions";

/** One big email field. Enter submits; there is no visible button. */
export function SignInForm({ initialEmail, initialError }: { initialEmail: string; initialError?: string }) {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(requestLink, {
    email: initialEmail,
    error: initialError,
  });

  if (state.sentTo) {
    return (
      <p role="status" className="mt-8 text-[17px] leading-relaxed text-fg">
        We sent a link to <span className="font-medium">{state.sentTo}</span>. It&apos;s valid for {LOGIN_LINK_TTL_MINUTES} minutes.
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-8 w-full">
      <label htmlFor="email" className="sr-only">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoFocus
        autoComplete="email"
        inputMode="email"
        enterKeyHint="go"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="you@email.com"
        defaultValue={state.email}
        key={state.email}
        disabled={pending}
        aria-invalid={Boolean(state.error)}
        aria-describedby={state.error ? "email-error" : undefined}
        className={`h-14 w-full rounded-xl border bg-card px-5 text-center text-[19px] text-fg outline-none placeholder:text-fg-3 focus:border-ink/50 disabled:opacity-60 ${
          state.error ? "border-red-700/60" : "border-line"
        }`}
      />
      {state.error ? (
        <p id="email-error" role="alert" className="mt-2 text-[14px] text-red-700">
          {state.error}
        </p>
      ) : null}
      {/* Kept for assistive tech and for browsers that need a submit control. */}
      <button type="submit" className="sr-only">
        Send login link
      </button>
    </form>
  );
}
