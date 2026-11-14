import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Logo } from "@/components/logo";
import { isValidEmail, normalizeEmail } from "@/lib/login-token";
import { getSession } from "@/lib/session";

import { SignInForm } from "./signin-form";

export const metadata: Metadata = { title: "Log in to Rows" };

type Props = { searchParams: Promise<{ error?: string; email?: string }> };

/**
 * Login is email only (MVP-23): logo, title, one field, the terms line.
 * Nothing else belongs on this page.
 */
export default function SignInPage({ searchParams }: Props) {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-[400px] flex-col items-center text-center">
        <Logo />
        <h1 className="mt-8 text-[2.2rem] leading-[1.1] text-fg">Log in to Rows</h1>
        <Suspense fallback={<div className="mt-8 h-14 w-full animate-pulse rounded-xl bg-ink/10" />}>
          <SignInBody searchParams={searchParams} />
        </Suspense>
        <p className="mt-6 text-[13px] leading-relaxed text-fg-3">
          By signing in you agree with our{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-fg">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-fg">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

async function SignInBody({ searchParams }: Props) {
  if (await getSession()) redirect("/dashboard");

  const { error, email } = await searchParams;
  const prefill = email && isValidEmail(normalizeEmail(email)) ? normalizeEmail(email) : "";
  return <SignInForm initialEmail={prefill} initialError={error === "expired" ? "Link expired. Request a new one." : undefined} />;
}
