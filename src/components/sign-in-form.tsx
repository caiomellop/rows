"use client";

import Link from "next/link";
import { FormEvent, useEffect, useId, useRef, useState } from "react";

import { RowsMark } from "@/components/rows-mark";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Mode = "email" | "code";

export function SignInForm({ oauthError }: { oauthError?: string }) {
  const [mode, setMode] = useState<Mode>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [touched, setTouched] = useState(false);
  const [focused, setFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const emailId = useId();
  const codeId = useId();

  useEffect(() => {
    inputRef.current?.focus();
  }, [mode]);

  const emailValid = EMAIL_RE.test(email.trim());
  const codeValid = code.trim().length >= 4;
  const showEmailError = mode === "email" && touched && email.length > 0 && !emailValid;
  const canContinue =
    mode === "email" ? emailValid : codeValid;

  function startGithub() {
    setSubmitting(true);
    window.location.assign("/auth");
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    if (!canContinue || submitting) return;
    startGithub();
  }

  return (
    <div className="sign-in-shell relative flex min-h-full flex-1 flex-col items-center justify-center overflow-hidden px-6 py-16">
      <div aria-hidden className="sign-in-atmosphere pointer-events-none absolute inset-0" />
      <div aria-hidden className="sign-in-grain pointer-events-none absolute inset-0" />

      <div className="relative z-10 flex w-full max-w-[20.5rem] flex-col items-center text-center sm:max-w-[24rem]">
        <Link
          href="/"
          className="text-ink transition-opacity hover:opacity-70"
          aria-label="Rows home"
        >
          <RowsMark className="h-[2.85rem] w-[2.85rem]" />
        </Link>

        <h1 className="mt-6 font-[family-name:var(--font-body)] text-[1.85rem] font-semibold leading-tight tracking-[-0.035em] text-ink sm:text-[2rem]">
          Enter Rows
        </h1>
        <p className="mt-2.5 text-[0.9375rem] leading-6 text-[#6b6b6b]">
          Sign up or sign in to get started.
        </p>

        {oauthError ? (
          <p className="mt-5 text-sm text-[#c44b3c]" role="alert">
            {oauthError === "access_denied"
              ? "GitHub authorization was cancelled."
              : oauthError}
          </p>
        ) : null}

        <form
          onSubmit={onSubmit}
          className="mt-14 flex w-full flex-col items-center"
          noValidate
        >
          {mode === "email" ? (
            <div className="relative w-full">
              <label htmlFor={emailId} className="sr-only">
                Email address
              </label>
              <input
                ref={inputRef}
                id={emailId}
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                placeholder="you@email.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (!touched && event.target.value.includes("@")) {
                    setTouched(true);
                  }
                }}
                onBlur={() => {
                  setFocused(false);
                  if (email.length > 0) setTouched(true);
                }}
                onFocus={() => setFocused(true)}
                className="sign-in-input w-full bg-transparent text-center text-[1.1875rem] font-medium tracking-[-0.03em] text-ink outline-none placeholder:font-normal placeholder:text-[#b0b0b0] sm:text-[1.3125rem]"
              />
              {focused ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-[calc(50%+min(46%,10rem))] hidden -translate-y-1/2 rounded-[4px] border border-black/15 px-[0.35rem] py-[0.2rem] text-[9px] font-medium leading-none tracking-[0.04em] text-black/40 sm:inline-block"
                >
                  Tab
                </span>
              ) : null}
              {showEmailError ? (
                <p className="mt-2.5 text-[0.8125rem] text-[#d14b3f]" role="alert">
                  Please enter a valid email address
                </p>
              ) : (
                <span className="mt-2.5 block h-[1.21875rem]" aria-hidden />
              )}
            </div>
          ) : (
            <div className="relative w-full">
              <label htmlFor={codeId} className="sr-only">
                Sign-in code
              </label>
              <input
                ref={inputRef}
                id={codeId}
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                placeholder="Enter your code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="sign-in-input w-full bg-transparent text-center text-[1.1875rem] font-medium tracking-[-0.03em] text-ink outline-none placeholder:font-normal placeholder:text-[#b0b0b0] sm:text-[1.3125rem]"
              />
              <span className="mt-2.5 block h-[1.21875rem]" aria-hidden />
            </div>
          )}

          <button
            type="submit"
            disabled={!canContinue || submitting}
            className="mt-7 flex h-[3.35rem] w-full items-center justify-center rounded-full bg-[#1a1a1a] text-[0.9375rem] font-medium text-white transition-[background-color,opacity,transform] duration-200 enabled:hover:bg-black enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#d6d6d4] disabled:text-white"
          >
            {submitting ? "Continuing…" : "Continue"}
          </button>
        </form>

        {mode === "email" ? (
          <button
            type="button"
            onClick={() => {
              setMode("code");
              setTouched(false);
            }}
            className="mt-5 border-0 bg-transparent p-0 text-[0.875rem] text-[#6b6b6b] outline-none transition-colors hover:text-ink focus-visible:underline"
          >
            I already have a code
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setMode("email");
              setCode("");
              setTouched(false);
            }}
            className="mt-5 border-0 bg-transparent p-0 text-[0.875rem] text-[#6b6b6b] outline-none transition-colors hover:text-ink focus-visible:underline"
          >
            Use email instead
          </button>
        )}

        <p className="mt-7 text-[0.75rem] leading-5 text-[#9a9a9a]">
          By signing in, you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-[#6b6b6b]">
            Terms
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            className="underline underline-offset-2 hover:text-[#6b6b6b]"
          >
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}
