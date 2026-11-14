"use client";

import Link from "next/link";
import { Fragment, useState } from "react";

import { BillingToggle } from "@/components/pricing/billing-toggle";
import { PlanCard } from "@/components/pricing/plan-card";
import {
  builderPlans,
  comparisonSections,
  displayPrice,
  proPlans,
  stackRows,
  testimonials,
  type BillingPeriod,
  type ComparisonCell,
} from "@/lib/pricing";

function Cell({ value }: { value: ComparisonCell }) {
  if (value === true) {
    return (
      <span aria-label="Included" className="inline-flex justify-center text-ink">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M3.5 8.5L6.5 11.5L12.5 4.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  if (value === false) {
    return <span className="text-ink/30">—</span>;
  }
  return <span className="text-[13px] text-ink/75">{value}</span>;
}

export function PricingView() {
  const [period, setPeriod] = useState<BillingPeriod>("annual");
  const [showBuilderCompare, setShowBuilderCompare] = useState(false);

  const comparePlans = [
    {
      id: "free",
      name: "Free",
      price: "$0",
      note: "forever",
      href: "/auth/signin",
      cta: "Start free",
    },
    {
      id: "starter",
      name: "Starter",
      price: displayPrice(proPlans[0], period),
      note: "/mo",
      href: "/auth/signin",
      cta: "Choose Starter",
    },
    {
      id: "pro",
      name: "Pro",
      price: displayPrice(proPlans[1], period),
      note: "/mo",
      href: "/auth/signin",
      cta: "Choose Pro",
    },
    {
      id: "max",
      name: "Max",
      price: displayPrice(proPlans[2], period),
      note: "/mo",
      href: "/auth/signin",
      cta: "Choose Max",
    },
  ] as const;

  return (
    <div className="pb-24">
      {/* Hero */}
      <section className="mx-auto max-w-3xl px-6 pt-14 text-center sm:px-8 sm:pt-20">
        <p className="anim-rise text-sm font-medium tracking-[-0.01em] text-ink/45">
          Pricing
        </p>
        <h1 className="anim-rise-delay mt-4 font-[family-name:var(--font-geist)] text-[clamp(2.4rem,6vw,3.75rem)] font-semibold leading-[1.05] tracking-[-0.045em] text-ink">
          Plans for builders,{" "}
          <span className="font-[family-name:var(--font-garamond)] font-normal italic tracking-[-0.02em]">
            professionals,
          </span>{" "}
          and teams
        </h1>
        <p className="anim-rise-delay-2 mx-auto mt-5 max-w-xl text-[1.05rem] leading-7 text-ink/55 sm:text-[1.125rem] sm:leading-8">
          Sync GitHub, shape experiences, and publish a public profile. Start
          free and upgrade when you need AI, domains, or more room.
        </p>
        <div className="anim-rise-delay-3 mt-8 flex justify-center">
          <BillingToggle period={period} onChange={setPeriod} />
        </div>
      </section>

      {/* Builder plans */}
      <section id="builder-plans" className="mx-auto mt-16 max-w-6xl px-6 sm:mt-20 sm:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-medium tracking-[-0.01em] text-ink/45">
            Builder plans
          </p>
          <h2 className="mt-2 font-[family-name:var(--font-geist)] text-3xl font-semibold tracking-[-0.035em] text-ink sm:text-4xl">
            For saving work and writing your story
          </h2>
          <p className="mt-3 text-[1.05rem] leading-7 text-ink/55">
            Sync repos, shape experiences, and publish — with AI when you want
            help grounded in what you actually built.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {builderPlans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} period={period} />
          ))}
        </div>
      </section>

      {/* Pro plans */}
      <section id="pro-plans" className="mx-auto mt-20 max-w-6xl px-6 sm:mt-24 sm:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-medium tracking-[-0.01em] text-ink/45">
            Pro plans
          </p>
          <h2 className="mt-2 font-[family-name:var(--font-geist)] text-3xl font-semibold tracking-[-0.035em] text-ink sm:text-4xl">
            For publishing and growing your presence
          </h2>
          <p className="mt-3 text-[1.05rem] leading-7 text-ink/55">
            Add custom domains, Hugging Face sync, deeper AI, and analytics as
            your portfolio becomes the front door to your work.
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {proPlans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} period={period} />
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-line bg-paper/80 px-6 py-5 sm:flex sm:items-center sm:justify-between sm:px-8">
          <p className="text-[15px] leading-6 text-ink/60">
            Or start free. No card, no deadline. Five projects and a public
            profile are included.
          </p>
          <Link
            href="/auth/signin"
            className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-ink px-6 text-sm font-medium tracking-[-0.01em] text-paper transition hover:bg-ink/88 sm:mt-0"
          >
            Start free
          </Link>
        </div>
      </section>

      {/* Team */}
      <section className="mx-auto mt-16 max-w-6xl px-6 sm:mt-20 sm:px-8">
        <div className="overflow-hidden rounded-[1.75rem] border border-line bg-[#dedfe3] px-6 py-10 sm:px-10 sm:py-12">
          <p className="text-sm font-medium tracking-[-0.01em] text-ink/45">
            Team
          </p>
          <div className="mt-3 grid gap-8 lg:grid-cols-[1.4fr_0.8fr] lg:items-end">
            <div>
              <h2 className="font-[family-name:var(--font-geist)] text-3xl font-semibold tracking-[-0.035em] text-ink sm:text-4xl">
                Working as a team, or running portfolios for clients?
              </h2>
              <p className="mt-4 max-w-2xl text-[1.05rem] leading-7 text-ink/60">
                Everything in Max, for unlimited people. Your team workspace
                plus 5 client profiles, then $9/month each. Shared AI credits,
                shared analytics, and a private Slack channel with Rows.
              </p>
            </div>
            <div className="lg:text-right">
              <p className="font-[family-name:var(--font-geist)] text-4xl font-semibold tracking-[-0.04em] text-ink">
                {period === "annual" ? "$166" : "$199"}
                <span className="text-base font-medium text-ink/45">
                  /month
                </span>
              </p>
              <p className="mt-1 text-sm text-ink/45">
                {period === "annual"
                  ? "Free for 7 days, then $1,990/year"
                  : "Free for 7 days, then billed monthly"}
              </p>
              <Link
                href="/auth/signin"
                className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-ink px-6 text-sm font-medium tracking-[-0.01em] text-paper transition hover:bg-ink/88"
              >
                Start free trial →
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-line bg-paper/70 px-6 py-6 sm:flex sm:items-center sm:justify-between sm:px-8">
          <div>
            <h3 className="font-[family-name:var(--font-geist)] text-xl font-semibold tracking-[-0.03em] text-ink">
              Need something bigger?
            </h3>
            <p className="mt-2 max-w-xl text-[15px] leading-6 text-ink/55">
              Enterprise is for big teams that need custom terms, invoices, and
              more usage than Team includes.
            </p>
          </div>
          <Link
            href="mailto:hello@rows.so"
            className="mt-4 inline-flex text-sm font-medium tracking-[-0.01em] text-ink underline-offset-4 hover:underline sm:mt-0"
          >
            Talk to us →
          </Link>
        </div>

        <p className="mt-6 text-center text-sm text-ink/45">
          All plans keep your profile intact. Upgrade, downgrade, or cancel when
          your needs change.
        </p>
      </section>

      {/* Testimonials */}
      <section className="mx-auto mt-20 max-w-6xl px-6 sm:mt-24 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {testimonials.map((item) => (
            <figure
              key={item.name}
              className="rounded-2xl border border-line bg-paper p-5"
            >
              <figcaption className="mb-4">
                <p className="font-[family-name:var(--font-geist)] text-sm font-semibold tracking-[-0.02em] text-ink">
                  {item.name}
                </p>
                <p className="text-xs text-ink/45">{item.role}</p>
              </figcaption>
              <blockquote className="font-[family-name:var(--font-garamond)] text-[1.05rem] leading-6 italic text-ink/70">
                “{item.quote}”
              </blockquote>
            </figure>
          ))}
        </div>
      </section>

      {/* Full comparison */}
      <section id="compare" className="mx-auto mt-20 max-w-6xl px-6 sm:mt-24 sm:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-medium tracking-[-0.01em] text-ink/45">
            Full comparison
          </p>
          <h2 className="mt-2 font-[family-name:var(--font-geist)] text-3xl font-semibold tracking-[-0.035em] text-ink sm:text-4xl">
            Every limit, feature, and allowance.
          </h2>
          <p className="mt-3 text-[1.05rem] leading-7 text-ink/55">
            Compare the details that matter once your project list grows, your
            AI usage climbs, or your public profile needs more room.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowBuilderCompare((v) => !v)}
            className="rounded-full border border-line bg-paper px-4 py-2 text-sm font-medium text-ink/70 transition hover:text-ink"
          >
            {showBuilderCompare ? "Hide Personal plans" : "Show Personal plans"}
          </button>
          <BillingToggle period={period} onChange={setPeriod} />
        </div>

        <p className="mt-4 text-sm text-ink/40 lg:hidden">
          Swipe sideways to compare every plan.
        </p>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-paper">
          <table className="min-w-[720px] w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                <th className="sticky left-0 bg-paper px-5 py-5 text-sm font-medium text-ink/50">
                  Workspace plan
                </th>
                {comparePlans.map((plan) => (
                  <th key={plan.id} className="px-4 py-5 text-center">
                    <div className="font-[family-name:var(--font-geist)] text-base font-semibold tracking-[-0.02em] text-ink">
                      {plan.name}
                    </div>
                    <div className="mt-1 text-sm text-ink/55">
                      {plan.price}
                      <span className="text-ink/40">{plan.note}</span>
                    </div>
                    <Link
                      href={plan.href}
                      className="mt-3 inline-flex text-xs font-medium text-ink underline-offset-4 hover:underline"
                    >
                      {plan.cta}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonSections.map((section) => (
                <Fragment key={section.title}>
                  <tr className="bg-[#f0f1f3]">
                    <td colSpan={5} className="px-5 py-4">
                      <p className="font-[family-name:var(--font-geist)] text-sm font-semibold tracking-[-0.02em] text-ink">
                        {section.title}
                      </p>
                      {section.description ? (
                        <p className="mt-0.5 text-xs text-ink/45">
                          {section.description}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                  {section.rows.map((row) => (
                    <tr
                      key={`${section.title}-${row.feature}`}
                      className="border-t border-line"
                    >
                      <td className="sticky left-0 bg-paper px-5 py-3.5 text-sm text-ink/75">
                        {row.feature}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <Cell value={row.free} />
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <Cell value={row.starter} />
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <Cell value={row.pro} />
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <Cell value={row.max} />
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              {showBuilderCompare ? (
                <Fragment>
                  <tr className="bg-[#f0f1f3]">
                    <td colSpan={5} className="px-5 py-4">
                      <p className="font-[family-name:var(--font-geist)] text-sm font-semibold tracking-[-0.02em] text-ink">
                        Personal plans
                      </p>
                      <p className="mt-0.5 text-xs text-ink/45">
                        Library-first plans for people who mostly need sync and
                        a clean public page.
                      </p>
                    </td>
                  </tr>
                  <tr className="border-t border-line">
                    <td className="sticky left-0 bg-paper px-5 py-3.5 text-sm text-ink/75">
                      Personal / Personal Plus
                    </td>
                    <td className="px-4 py-3.5 text-center text-[13px] text-ink/55">
                      —
                    </td>
                    <td className="px-4 py-3.5 text-center text-[13px] text-ink/75">
                      Personal {displayPrice(builderPlans[0], period)}/mo
                    </td>
                    <td className="px-4 py-3.5 text-center text-[13px] text-ink/75">
                      Plus {displayPrice(builderPlans[1], period)}/mo
                    </td>
                    <td className="px-4 py-3.5 text-center text-[13px] text-ink/55">
                      —
                    </td>
                  </tr>
                </Fragment>
              ) : null}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-sm text-ink/40">
          AI credits reset monthly on paid plans. Project and experience limits
          apply per workspace.
        </p>
      </section>

      {/* Stack comparison */}
      <section className="mx-auto mt-20 max-w-6xl px-6 sm:mt-24 sm:px-8">
        <div className="rounded-[1.75rem] bg-[#dedfe3] px-6 py-10 sm:px-10 sm:py-12">
          <p className="text-sm font-medium tracking-[-0.01em] text-ink/45">
            What you can cancel
          </p>
          <h2 className="mt-3 max-w-3xl font-[family-name:var(--font-geist)] text-3xl font-semibold tracking-[-0.035em] text-ink sm:text-4xl">
            One subscription{" "}
            <span className="font-[family-name:var(--font-garamond)] font-normal italic tracking-[-0.02em]">
              instead of seven.
            </span>
          </h2>
          <blockquote className="mt-6 max-w-2xl font-[family-name:var(--font-garamond)] text-xl leading-8 italic text-ink/65">
            “I’ve deleted my Notion portfolio, Carrd, and a half-maintained
            GitHub Pages site. Finally, one place that stays current with the
            work.”
          </blockquote>
          <p className="mt-3 text-sm text-ink/45">Maya Chen, staff engineer</p>

          <div className="mt-8 overflow-hidden rounded-2xl border border-line bg-paper">
            {stackRows.map((row, index) => (
              <div
                key={row.category}
                className={
                  index === 0
                    ? "flex flex-col gap-2 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8 sm:px-7"
                    : "flex flex-col gap-2 border-t border-line px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8 sm:px-7"
                }
              >
                <div>
                  <p className="font-[family-name:var(--font-geist)] text-[15px] font-semibold tracking-[-0.02em] text-ink">
                    {row.category}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-ink/45">
                    {row.tools}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-medium text-ink sm:pt-0.5">
                  {row.from}
                </p>
              </div>
            ))}

            <div className="border-t border-line bg-[#f7f7f8] px-5 py-5 sm:flex sm:items-center sm:justify-between sm:px-7">
              <p className="font-[family-name:var(--font-geist)] text-[15px] font-semibold tracking-[-0.02em] text-ink">
                The cheapest version of that stack
              </p>
              <p className="mt-1 text-sm font-medium text-ink sm:mt-0">
                $64/mo
              </p>
            </div>
            <div className="border-t border-line px-5 py-5 sm:flex sm:items-start sm:justify-between sm:gap-8 sm:px-7">
              <div>
                <p className="font-[family-name:var(--font-geist)] text-[15px] font-semibold tracking-[-0.02em] text-ink">
                  Rows Personal
                </p>
                <p className="mt-1 text-sm leading-6 text-ink/45">
                  The portfolio half. Sync, experiences, and a public page.
                </p>
              </div>
              <p className="mt-2 shrink-0 text-sm font-medium text-ink sm:mt-0">
                {displayPrice(builderPlans[0], period)}/mo
              </p>
            </div>
            <div className="border-t border-line px-5 py-5 sm:flex sm:items-start sm:justify-between sm:gap-8 sm:px-7">
              <div>
                <p className="font-[family-name:var(--font-geist)] text-[15px] font-semibold tracking-[-0.02em] text-ink">
                  Rows Starter
                </p>
                <p className="mt-1 text-sm leading-6 text-ink/45">
                  Every job above, including AI About, a custom domain, and
                  analytics. Rows tagged Pro need Pro.
                </p>
              </div>
              <p className="mt-2 shrink-0 text-sm font-medium text-ink sm:mt-0">
                {displayPrice(proPlans[0], period)}/mo
              </p>
            </div>
          </div>

          <div className="mt-6">
            <Link
              href="#pro-plans"
              className="text-sm font-medium text-ink underline-offset-4 hover:underline"
            >
              See all plans
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto mt-20 max-w-3xl px-6 text-center sm:mt-24 sm:px-8">
        <p className="text-sm font-medium tracking-[-0.01em] text-ink/45">
          Start with Free
        </p>
        <h2 className="mt-3 font-[family-name:var(--font-geist)] text-3xl font-semibold tracking-[-0.035em] text-ink sm:text-4xl">
          Give your best work somewhere to live.
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-[1.05rem] leading-7 text-ink/55">
          No card. No deadline. Five projects and your public profile are
          included.
        </p>
        <Link
          href="/auth/signin"
          className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-ink px-7 text-[15px] font-medium tracking-[-0.01em] text-paper transition hover:bg-ink/88"
        >
          Start free
        </Link>
      </section>
    </div>
  );
}
