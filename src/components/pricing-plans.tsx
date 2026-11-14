"use client";

import Link from "next/link";
import { useState } from "react";

import { ArrowRight, Check } from "@/components/icons";
import {
  ANNUAL_SAVINGS_LABEL,
  type BillingCycle,
  type Plan,
  PLANS,
  formatPrice,
} from "@/lib/pricing";

/** Spec §6.2: billing toggle. Annual is the default. */
function BillingToggle({
  value,
  onChange,
}: {
  value: BillingCycle;
  onChange: (v: BillingCycle) => void;
}) {
  const options: BillingCycle[] = ["monthly", "annual"];
  return (
    <div className="flex justify-center pb-1">
      <div
        role="group"
        aria-label="Billing period"
        className="inline-flex items-center gap-1 rounded-full border border-ink/10 bg-ink/[0.04] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_2px_10px_rgba(0,0,0,0.08)]"
      >
        {options.map((option) => {
          const active = option === value;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option)}
              className={`inline-flex items-center rounded-full border px-4 py-1.5 text-[0.85rem] capitalize transition-colors ${
                active
                  ? "border-ink/16 bg-ink/10 text-fg"
                  : "border-transparent text-fg-2 hover:text-fg"
              }`}
            >
              {option}
              {option === "annual" ? (
                <span className="ml-2 rounded-full bg-accent/12 px-1.5 py-0.5 font-geist text-[0.68rem] normal-case text-accent">
                  {ANNUAL_SAVINGS_LABEL}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Spec §6.2: plan card (featured variant gets badge, stronger border, primary CTA). */
function PlanCard({ plan, cycle }: { plan: Plan; cycle: BillingCycle }) {
  const perMonth = cycle === "annual" ? plan.annualPerMonth : plan.monthly;
  const billedNote =
    cycle === "annual"
      ? `Billed ${formatPrice(plan.annualPerMonth * 12)}/year`
      : "Billed monthly";

  return (
    <article
      className={`relative flex h-full flex-col rounded-[18px] border bg-card p-6 ${
        plan.featured
          ? "border-ink/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_45px_-18px_rgba(0,0,0,0.25)]"
          : "border-line shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-18px_rgba(0,0,0,0.12)]"
      }`}
    >
      {plan.featured ? (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-linear-to-b from-ink to-[rgb(var(--cta-to))] px-3 py-1 text-[0.68rem] font-medium text-page shadow-[0_4px_14px_-4px_rgba(0,0,0,0.5)]">
          Most popular
        </div>
      ) : null}

      <h3 className="m-0 text-[1.3rem] text-fg">{plan.name}</h3>
      <p className="mb-0 mt-2 min-h-[3.25rem] text-[0.875rem] leading-normal text-fg-2">
        {plan.description}
      </p>

      <div className="mt-5">
        <div className="flex items-end gap-1">
          <span className="text-[2.15rem] leading-none tabular-nums text-fg">
            {formatPrice(perMonth)}
          </span>
          <span className="pb-1 text-[0.78rem] text-fg-2">/month</span>
        </div>
        <div className="mt-1 min-h-5 text-[0.74rem] tabular-nums text-fg-3">
          {billedNote}
        </div>
      </div>

      <Link
        href={`/auth/signin?plan=${plan.id}_${cycle}`}
        className={`group mt-4 rounded-full px-4 py-2 text-[0.85rem] ${
          plan.featured ? "btn-primary" : "btn-secondary"
        }`}
      >
        Choose {plan.name}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </Link>

      <ul className="m-0 mt-5 flex-1 list-none space-y-2.5 border-t border-line-subtle p-0 pt-5">
        {plan.includesLabel ? (
          <li className="mb-1 text-[0.75rem] font-medium text-fg-3">
            {plan.includesLabel}
          </li>
        ) : null}
        {plan.features.map((feature) => (
          <li
            key={feature.text}
            className={`flex items-start gap-2 text-[0.875rem] leading-normal ${
              feature.muted ? "text-fg-3" : "text-fg-2"
            }`}
          >
            <Check
              className={`mt-[0.2em] size-[15px] shrink-0 ${feature.muted ? "text-fg-3" : "text-fg"}`}
            />
            <span>
              {feature.highlight ? (
                <strong className="font-semibold text-fg">{feature.text}</strong>
              ) : (
                feature.text
              )}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function PricingPlans() {
  const [cycle, setCycle] = useState<BillingCycle>("annual");

  return (
    <>
      <BillingToggle value={cycle} onChange={setCycle} />

      {/* Spec §6.2: plan group panel */}
      <section
        aria-labelledby="plans-heading"
        className="rounded-[24px] border border-line bg-ink/[0.015] p-4 sm:p-5 lg:p-6"
      >
        <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="font-geist text-[0.82rem] font-medium tracking-[-0.01em] text-accent">
              Portfolio plans
            </div>
            <h2 id="plans-heading" className="m-0 mt-1 text-[1.45rem] leading-tight text-fg">
              For building and publishing your work
            </h2>
          </div>
          <p className="m-0 max-w-md text-[0.82rem] leading-snug text-fg-2">
            Every plan syncs with GitHub and gives you a public profile you can share.
          </p>
        </div>

        <div className="grid items-stretch gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} cycle={cycle} />
          ))}
        </div>
      </section>
    </>
  );
}
