import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Logo } from "@/components/logo";
import { getSession } from "@/lib/session";

async function SignInBody({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getSession();
  if (user) {
    redirect("/dashboard");
  }

  const { error } = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <div>
        <Logo />
      </div>
      <h1 className="mt-10 text-[2.6rem] leading-[1.05] text-fg-2">
        Sign in to <span className="text-accent">Rows</span>
      </h1>
      <p className="mt-3 font-geist text-base leading-7 text-fg-2">
        Continue with GitHub to create your account.
      </p>
      {error ? (
        <p className="mt-4 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <a
        href="/auth"
        className="btn-primary mt-8 h-12 rounded-xl px-5 text-[0.95rem]"
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
    <main className="relative flex min-h-full flex-1 flex-col overflow-hidden">
      <div
        aria-hidden
        className="dot-grid dot-grid-center pointer-events-none absolute inset-0 -z-10"
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
