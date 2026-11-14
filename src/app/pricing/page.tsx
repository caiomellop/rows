import type { Metadata } from "next";
import Link from "next/link";

import { ArrowRight } from "@/components/icons";
import { PricingPlans } from "@/components/pricing-plans";
import { SiteNav } from "@/components/site-nav";
import { appHref } from "@/lib/app-url";

export const metadata: Metadata = {
  title: "Pricing · Rows",
  description: "Plans for developers, freelancers and small teams.",
};

export default function PricingPage() {
  return (
    <>
      <SiteNav />
      <main className="flex flex-1 flex-col">
        {/* Spec §6.1: pricing hero */}
        <section className="relative overflow-hidden px-6 pb-[clamp(4rem,8vw,6rem)] pt-[clamp(5rem,10vw,8rem)] md:px-8">
          <div
            aria-hidden
            className="dot-grid dot-grid-center pointer-events-none absolute inset-0 -z-10 opacity-70"
          />
          <div className="relative mx-auto max-w-3xl text-center">
            <p className="mb-5 font-geist text-[0.82rem] font-medium tracking-[-0.01em] text-accent">
              Pricing
            </p>
            <h1 className="m-0 text-balance text-[clamp(2.65rem,6vw,4.7rem)] leading-[0.98] text-fg-2">
              Plans for <span className="text-accent">developers, freelancers, and teams</span>
            </h1>
            <p className="mx-auto mb-0 mt-6 max-w-2xl text-balance font-geist text-[clamp(1rem,1.7vw,1.16rem)] leading-relaxed text-fg-2">
              Turn your repos into a portfolio, write the story behind them, and publish a
              profile worth sharing. Start free and upgrade when you need more.
            </p>
          </div>
        </section>

        {/* Spec §6.2: framed plans area with a corner dot patch */}
        <div className="relative border-t border-line">
          <div
            aria-hidden
            className="dot-grid dot-grid-corner-left pointer-events-none absolute left-0 top-0 h-[460px] w-[min(720px,100%)]"
          />
          <div className="relative mx-auto max-w-[1240px] space-y-5 px-4 py-[clamp(3.5rem,7vw,5.5rem)] sm:px-6 md:px-8">
            <PricingPlans />

            <div className="flex flex-col items-start justify-between gap-3 rounded-[20px] border border-line bg-ink/[0.015] px-5 py-4 sm:flex-row sm:items-center">
              <p className="m-0 text-[0.92rem] leading-snug text-fg-2">
                <span className="text-fg">Or start free.</span> No card needed. A public
                profile and GitHub sync are included.
              </p>
              <Link
                href={appHref("/sign-in")}
                className="btn-secondary group shrink-0 rounded-full px-4 py-2 text-[0.85rem]"
              >
                Start free
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>

            <div className="space-y-1 pt-1 text-center text-[0.8rem] text-fg-3">
              <p className="m-0">
                Your profile stays online on every plan. Upgrade, downgrade, or cancel anytime.
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
