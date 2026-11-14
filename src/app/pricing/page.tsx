import type { Metadata } from "next";

import { PricingView } from "@/components/pricing/pricing-view";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Rows Pricing | Plans for Builders and Teams",
  description:
    "Compare every Rows plan — GitHub sync, AI About, custom domains, analytics, and team features. Start free.",
};

export default function PricingPage() {
  return (
    <main className="relative flex min-h-full flex-1 flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20"
        style={{
          background:
            "radial-gradient(ellipse 90% 55% at 50% 0%, #fafafa 0%, transparent 55%), linear-gradient(180deg, #ececef 0%, #e6e7ea 40%, #e0e1e5 100%)",
        }}
      />
      <div
        aria-hidden
        className="grain-shift pointer-events-none absolute inset-0 -z-10 opacity-[0.28] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")",
          backgroundSize: "180px 180px",
        }}
      />

      <SiteHeader active="pricing" />
      <PricingView />
    </main>
  );
}
