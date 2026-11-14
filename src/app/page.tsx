import Link from "next/link";
import { Suspense } from "react";

import { LandingCta } from "@/components/landing-cta";

export default function Home() {
  return (
    <main className="relative flex min-h-full flex-1 flex-col overflow-hidden">
      <div
        aria-hidden
        className="bg-drift pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 15% 20%, var(--glow), transparent 55%), radial-gradient(ellipse 70% 50% at 90% 10%, rgba(18, 21, 28, 0.08), transparent 50%), linear-gradient(160deg, #f7f5f0 0%, #eef2ef 45%, #e4ebe6 100%)",
        }}
      />

      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 pt-8">
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-ink"
        >
          Rows
        </Link>
      </header>

      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 pb-24 pt-16">
        <p className="anim-rise font-[family-name:var(--font-display)] text-6xl font-semibold leading-[0.95] tracking-tight text-ink sm:text-7xl md:text-8xl">
          Rows
        </p>
        <h1 className="anim-rise-delay mt-6 max-w-xl text-2xl font-medium leading-snug text-ink/90 sm:text-3xl">
          Turn your GitHub into a portfolio that actually looks like you.
        </h1>
        <p className="anim-rise-delay mt-4 max-w-md text-base leading-7 text-ink/60">
          Sync repos, shape experiences, publish a public profile.
        </p>
        <div className="anim-rise-delay-2 mt-10">
          <Suspense
            fallback={
              <span className="inline-flex h-12 w-36 animate-pulse rounded-md bg-ink/10" />
            }
          >
            <LandingCta />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
