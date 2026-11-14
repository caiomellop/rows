import Link from "next/link";

import { displayPrice, type BillingPeriod, type Plan } from "@/lib/pricing";

export function PlanCard({
  plan,
  period,
}: {
  plan: Plan;
  period: BillingPeriod;
}) {
  return (
    <article
      className={
        plan.popular
          ? "relative flex h-full flex-col rounded-2xl border border-ink/15 bg-paper p-6 shadow-[0_18px_50px_rgba(12,12,13,0.08)] sm:p-7"
          : "relative flex h-full flex-col rounded-2xl border border-line bg-paper p-6 sm:p-7"
      }
    >
      {plan.popular ? (
        <span className="absolute -top-3 left-6 rounded-full bg-ink px-3 py-1 text-[11px] font-medium tracking-[-0.01em] text-paper">
          Most popular
        </span>
      ) : null}

      <div className="flex flex-1 flex-col">
        <h3 className="font-[family-name:var(--font-geist)] text-xl font-semibold tracking-[-0.03em] text-ink">
          {plan.name}
        </h3>
        <p className="mt-2 text-[15px] leading-6 text-ink/55">{plan.blurb}</p>

        <div className="mt-6">
          <p className="flex items-baseline gap-1">
            <span className="font-[family-name:var(--font-geist)] text-[2.35rem] font-semibold tracking-[-0.04em] text-ink">
              {displayPrice(plan, period)}
            </span>
            <span className="text-sm text-ink/45">/month</span>
          </p>
          {period === "annual" ? (
            <p className="mt-1 text-sm text-ink/45">
              Billed ${plan.annualTotal.toLocaleString("en-US")}/year
            </p>
          ) : (
            <p className="mt-1 text-sm text-ink/45">Billed monthly</p>
          )}
        </div>

        <Link
          href={plan.href}
          className={
            plan.popular
              ? "mt-6 inline-flex h-11 items-center justify-center rounded-full bg-ink px-5 text-sm font-medium tracking-[-0.01em] text-paper transition hover:bg-ink/88"
              : "mt-6 inline-flex h-11 items-center justify-center rounded-full border border-ink/15 bg-transparent px-5 text-sm font-medium tracking-[-0.01em] text-ink transition hover:border-ink/30 hover:bg-ink/[0.03]"
          }
        >
          {plan.cta}
        </Link>

        <ul className="mt-7 space-y-3 border-t border-line pt-6">
          {plan.features.map((feature) => (
            <li
              key={feature}
              className="flex gap-2.5 text-[14px] leading-5 text-ink/70"
            >
              <span
                aria-hidden
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink/35"
              />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
