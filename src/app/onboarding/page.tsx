import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { OnboardingShell, OnboardingSkeleton } from "@/components/onboarding-shell";
import { appUrl } from "@/lib/app-url";
import { ONBOARDING_NEXT_PATH, checkHandle, getProfile } from "@/lib/profile";
import { getSession } from "@/lib/session";
import { toHandle } from "@/lib/username";

import type { ClaimHandleState } from "./actions";
import { HandleForm } from "./handle-form";

export const metadata: Metadata = { title: "Choose your handle · Rows" };

/** Reads the session, so it streams in behind Suspense. */
async function HandleStep() {
  const user = await getSession();
  if (!user) redirect("/auth/signin");

  const profile = await getProfile(user.id);
  if (profile?.username) redirect(ONBOARDING_NEXT_PATH);

  // Pre-fill with the GitHub login, normalized. If that one is taken or
  // reserved, say so right away and offer the alternative.
  const handle = toHandle(profile?.githubLogin ?? user.name ?? "");
  const check = handle ? await checkHandle(handle) : null;
  const initialState: ClaimHandleState =
    check && !check.ok
      ? { handle, error: check.message, suggestion: check.suggestion }
      : { handle };

  return (
    <>
      <h1 className="mt-10 text-[2.6rem] leading-[1.05] text-fg-2">
        Choose your <span className="text-accent">handle</span>
      </h1>
      <p className="mt-3 font-geist text-base leading-7 text-fg-2">
        It&apos;s the address of your Rows profile. We started from your GitHub
        login.
      </p>
      <HandleForm
        initialState={initialState}
        urlPrefix={`${new URL(appUrl()).host}/u/`}
      />
    </>
  );
}

export default function OnboardingPage() {
  return (
    <OnboardingShell step="Handle">
      <Suspense fallback={<OnboardingSkeleton />}>
        <HandleStep />
      </Suspense>
    </OnboardingShell>
  );
}
