import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { OnboardingShell, OnboardingSkeleton } from "@/components/onboarding-shell";
import { appUrl } from "@/lib/app-url";
import { DISCOVERY_DIMENSIONS, FIRST_QUESTION } from "@/lib/discovery";
import { getProfile } from "@/lib/profile";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Discovery · Rows" };

/**
 * Entry point of the discovery: shows the first question.
 * The conversation itself (answers, follow-ups, saved context) is MVP-09.
 */
async function FirstQuestion() {
  const user = await getSession();
  if (!user) redirect("/auth/signin");

  const profile = await getProfile(user.id);
  if (!profile?.username) redirect("/onboarding");

  const host = new URL(appUrl()).host;

  return (
    <>
      <p className="mt-10 font-geist text-sm text-fg-3">
        Your profile lives at{" "}
        <span className="font-medium text-fg">
          {host}/u/{profile.username}
        </span>
      </p>

      <h1 className="mt-3 text-[2.6rem] leading-[1.05] text-fg-2">
        Let&apos;s find what <span className="text-accent">you delivered</span>
      </h1>
      <p className="mt-3 font-geist text-base leading-7 text-fg-2">
        A few questions in three parts:{" "}
        {DISCOVERY_DIMENSIONS.join(", ").toLowerCase()}. Your answers become
        your profile.
      </p>

      <section
        aria-labelledby="first-question"
        className="mt-8 rounded-2xl border border-line bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
      >
        <p className="font-geist text-xs font-medium tracking-wide text-fg-3 uppercase">
          1 · {FIRST_QUESTION.dimension}
        </p>
        <h2 id="first-question" className="mt-2 text-2xl leading-snug text-fg">
          {FIRST_QUESTION.text}
        </h2>
        <p className="mt-3 text-sm leading-6 text-fg-2">{FIRST_QUESTION.hint}</p>
      </section>

      <p className="mt-4 text-sm text-fg-3">
        The guided chat that takes your answers is launching soon. We&apos;ll
        pick up right here.
      </p>
    </>
  );
}

export default function DiscoveryPage() {
  return (
    <OnboardingShell step="Discovery">
      <Suspense fallback={<OnboardingSkeleton />}>
        <FirstQuestion />
      </Suspense>
    </OnboardingShell>
  );
}
