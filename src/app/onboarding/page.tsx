import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Logo } from "@/components/logo";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { appUrl } from "@/lib/app-url";
import { requireUser } from "@/lib/dal";

import { HandleForm } from "./handle-form";

export const metadata: Metadata = { title: "Choose your handle | Rows", robots: { index: false } };

/**
 * First access after the email login (MVP-23): choose the unique handle.
 * The rest of the onboarding (discovery) is MVP-06.
 */
export default function OnboardingPage() {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-[400px] flex-col items-center text-center">
        <Logo />
        <h1 className="mt-8 text-[2.2rem] leading-[1.1] text-fg">Choose your handle</h1>
        <p className="mt-3 text-[15px] text-fg-2">This is the address of your public profile.</p>
        <Suspense fallback={<div className="mt-8 h-14 w-full animate-pulse rounded-xl bg-ink/10" />}>
          <Handle />
        </Suspense>
      </div>
    </main>
  );
}

async function Handle() {
  const user = await requireUser();
  const [profile] = await db.select({ id: profiles.userId }).from(profiles).where(eq(profiles.userId, user.id)).limit(1);
  if (profile) redirect("/dashboard");

  const host = appUrl().replace(/^https?:\/\//, "");
  return <HandleForm urlPrefix={`${host}/in/@`} />;
}
