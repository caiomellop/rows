import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { loadEditor } from "@/app/(app)/dashboard/load";
import { PageHeader, PageSkeleton } from "@/app/(app)/dashboard/skeleton";
import { Check } from "@/components/icons";

export const metadata: Metadata = { title: "Dashboard · Rows" };

export default function DashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Overview />
    </Suspense>
  );
}

async function Overview() {
  const { profile, experiences } = await loadEditor();

  const steps = [
    {
      done: experiences.length > 0,
      title: "Add your experience",
      body: "Upload your resume or LinkedIn PDF, or build it from scratch with the AI assistant.",
      href: "/dashboard/experience",
      cta: "Add experience",
    },
    {
      done: Boolean(profile.headline && profile.summary),
      title: "Write your headline and summary",
      body: "The short header that sums you up. AI can draft it from your experience.",
      href: "/dashboard/profile",
      cta: "Edit profile",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Build your profile">Two steps, about five minutes. The AI uses them to write and prepare you.</PageHeader>

      <ol className="surface divide-y divide-line">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-4 p-5 md:p-6">
            <span
              aria-hidden
              className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-medium ${
                step.done ? "bg-ink text-page" : "border border-ink/20 text-fg-2"
              }`}
            >
              {step.done ? <Check className="size-3.5" /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-sans text-[16px] font-medium text-fg">
                {step.title}
                <span className="sr-only">{step.done ? " (done)" : " (to do)"}</span>
              </h2>
              <p className="mt-1 text-[14px] leading-relaxed text-fg-2">{step.body}</p>
            </div>
            <Link href={step.href} className="btn-secondary h-9 shrink-0 self-center rounded-lg px-3.5 text-[14px]">
              {step.done ? "Edit" : step.cta}
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
