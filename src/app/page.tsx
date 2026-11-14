import { Suspense } from "react";

import { HeroTypewriter } from "@/components/hero-typewriter";
import { LandingCta } from "@/components/landing-cta";
import { SiteNav } from "@/components/site-nav";

// Keep the lead-in short enough for one line at desktop size (~25 chars); the
// italic phrase always sits on its own second line (spec §5).
const LEAD_IN = "A developer portfolio that";
const PHRASES = [
  "looks like you.",
  "updates itself.",
  "tells your story.",
  "gets you hired.",
];

export default function Home() {
  return (
    <>
      <SiteNav />
      <main className="relative flex flex-1 flex-col">
        {/* Spec §5: home hero */}
        <section className="relative overflow-x-clip px-5 pb-[clamp(2.5rem,5vw,4rem)] pt-[clamp(80px,12vh,128px)] text-center md:px-8">
          <div
            aria-hidden
            className="dot-grid dot-grid-center pointer-events-none absolute inset-x-0 top-0 -z-10 h-[min(820px,100%)]"
          />

          <h1 className="anim-rise mx-auto mb-6 max-w-[820px] text-balance text-[clamp(2.4rem,5vw,4.1rem)] leading-[1.05] text-fg-2">
            <span className="sr-only">
              {LEAD_IN} {PHRASES.join(", ").replace(/\.(?=,)/g, "")}
            </span>
            <span aria-hidden>
              {LEAD_IN} <HeroTypewriter phrases={PHRASES} />
            </span>
          </h1>

          <p className="anim-rise-delay mx-auto mb-5 max-w-[680px] text-balance font-geist text-[clamp(0.98rem,1.65vw,1.28rem)] leading-snug text-fg-2">
            Sync your repos, <span className="text-fg">shape your experiences</span>,
            let AI draft your About, and{" "}
            <span className="text-fg">publish a profile people remember</span> at
            your own link.
          </p>

          <div className="anim-rise-delay-2 mx-auto flex w-full flex-col items-center justify-center gap-2.5 sm:flex-row sm:gap-3.5">
            <Suspense
              fallback={
                <span className="inline-block h-[45px] w-[150px] rounded-xl bg-ink/10" />
              }
            >
              <LandingCta />
            </Suspense>
          </div>
        </section>
      </main>
    </>
  );
}
