import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Logo } from "@/components/logo";
import { peekLoginToken } from "@/lib/login-link";
import { expiredLinkUrl } from "@/lib/login-token";

import { confirmLogin } from "./actions";

export const metadata: Metadata = { title: "Log in to Rows", robots: { index: false } };

type Props = { searchParams: Promise<{ token?: string }> };

/**
 * Landing page of the emailed link. Opening it spends nothing: corporate mail
 * scanners follow links on their own, so only the button's POST logs in.
 * Works from any device or browser.
 */
export default function VerifyPage({ searchParams }: Props) {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-[400px] flex-col items-center text-center">
        <Logo />
        <h1 className="mt-8 text-[2.2rem] leading-[1.1] text-fg">Log in to Rows</h1>
        <Suspense fallback={<div className="mt-8 h-14 w-full animate-pulse rounded-xl bg-ink/10" />}>
          <Confirm searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function Confirm({ searchParams }: Props) {
  const { token } = await searchParams;
  if (!token) redirect(expiredLinkUrl(null));

  const { status, email } = await peekLoginToken(token);
  if (status !== "valid") redirect(expiredLinkUrl(email));

  return (
    <form action={confirmLogin} className="mt-8 w-full">
      <input type="hidden" name="token" value={token} />
      <p className="text-[15px] text-fg-2">
        Continue as <span className="font-medium text-fg">{email}</span>
      </p>
      <button type="submit" autoFocus className="btn-primary mt-5 h-14 w-full rounded-xl text-[17px]">
        Log in
      </button>
    </form>
  );
}
