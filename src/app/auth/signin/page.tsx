import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getSession } from "@/lib/session";

async function SignInBody({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getSession();
  if (user) {
    redirect("/");
  }

  const { error } = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <Link
        href="/"
        className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight text-ink"
      >
        Rows
      </Link>
      <h1 className="mt-10 text-3xl font-semibold tracking-tight text-ink">
        Sign in
      </h1>
      <p className="mt-3 text-base leading-7 text-ink/60">
        Continue with GitHub to create your account.
      </p>
      {error ? (
        <p className="mt-4 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <a
        href="/auth"
        className="mt-8 inline-flex h-12 items-center justify-center rounded-md bg-ink px-5 text-sm font-semibold text-white transition hover:bg-ink/85"
      >
        Sign in with GitHub
      </a>
    </div>
  );
}

export default function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <main className="relative flex min-h-full flex-1 flex-col overflow-hidden bg-[#f3f1ec]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 80% 0%, rgba(31, 107, 74, 0.12), transparent 55%), linear-gradient(180deg, #f7f5f0, #eef2ef)",
        }}
      />
      <Suspense
        fallback={
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
            <div className="h-8 w-24 animate-pulse rounded bg-ink/10" />
            <div className="mt-10 h-10 w-40 animate-pulse rounded bg-ink/10" />
          </div>
        }
      >
        <SignInBody searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
