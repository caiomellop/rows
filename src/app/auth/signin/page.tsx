import { redirect } from "next/navigation";
import { Suspense } from "react";

import { BrandLink } from "@/components/brand-link";
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
      <BrandLink wordmarkClassName="font-[family-name:var(--font-geist)] text-[1.25rem] font-semibold tracking-[-0.04em] text-ink" />
      <h1 className="mt-10 font-[family-name:var(--font-garamond)] text-4xl italic tracking-[-0.02em] text-ink">
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
        className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-ink px-5 text-[15px] font-medium text-paper transition hover:bg-ink/88"
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
    <main className="relative flex min-h-full flex-1 flex-col overflow-hidden bg-[#e8e9eb]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 85% 0%, rgba(12,12,13,0.05), transparent 55%), linear-gradient(180deg, #f0f0f2, #e4e5e8)",
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
