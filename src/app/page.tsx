import Image from "next/image";
import { Suspense } from "react";

import { LandingCta } from "@/components/landing-cta";
import { SiteHeader } from "@/components/site-header";

export default function Home() {
  return (
    <main className="relative flex min-h-full flex-1 flex-col overflow-hidden">
      {/* Atmosphere — full-bleed field, not a flat fill */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20"
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 70% 35%, #fafafa 0%, transparent 55%), radial-gradient(ellipse 60% 50% at 10% 80%, rgba(12,12,13,0.06) 0%, transparent 50%), linear-gradient(165deg, #ececef 0%, #e4e5e8 42%, #d9dade 100%)",
        }}
      />

      {/* Soft grain matching the mark */}
      <div
        aria-hidden
        className="grain-shift pointer-events-none absolute inset-0 -z-10 opacity-[0.35] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")",
          backgroundSize: "180px 180px",
        }}
      />

      {/* Dominant visual: brand mark, edge-to-edge plane */}
      <div
        aria-hidden
        className="mark-drift pointer-events-none absolute inset-y-0 right-[-8%] -z-10 flex w-[min(72vw,720px)] items-center justify-center max-md:inset-x-0 max-md:top-[38%] max-md:bottom-auto max-md:mx-auto max-md:h-[52vh] max-md:w-[90vw] max-md:opacity-40"
      >
        <Image
          src="/brand/rows-mark.png"
          alt=""
          width={720}
          height={720}
          priority
          className="h-auto w-full object-contain opacity-[0.92] mix-blend-multiply max-md:mix-blend-normal max-md:opacity-50"
        />
      </div>

      <SiteHeader active="home" />

      <section className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 pb-20 pt-16 sm:px-8 sm:pb-24 sm:pt-10 md:pt-0">
        <p className="anim-rise font-[family-name:var(--font-geist)] text-[clamp(3.25rem,9vw,6.75rem)] font-semibold leading-[0.9] tracking-[-0.055em] text-ink">
          Rows
        </p>

        <h1 className="anim-rise-delay mt-7 max-w-[16ch] font-[family-name:var(--font-garamond)] text-[clamp(1.85rem,4.2vw,3.15rem)] font-normal italic leading-[1.15] tracking-[-0.02em] text-ink sm:mt-8">
          Finally, one place to turn your work into a portfolio that feels like
          you.
        </h1>

        <p className="anim-rise-delay-2 mt-5 max-w-md text-[1.05rem] leading-7 text-ink/60 sm:mt-6 sm:text-[1.125rem] sm:leading-8">
          Sync GitHub, shape your experiences, and publish a public profile —
          without starting from a blank page.
        </p>

        <div className="anim-rise-delay-3 mt-9 sm:mt-11">
          <Suspense
            fallback={
              <span className="inline-flex h-12 w-36 animate-pulse rounded-full bg-ink/10" />
            }
          >
            <LandingCta />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
