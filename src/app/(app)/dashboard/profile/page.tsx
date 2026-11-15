import type { Metadata } from "next";
import { Suspense } from "react";

import { loadEditor } from "@/app/(app)/dashboard/load";
import { PageHeader, PageSkeleton } from "@/app/(app)/dashboard/skeleton";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { aiEnabled } from "@/lib/ai";

export const metadata: Metadata = { title: "Profile · Prepermint" };

export default function ProfilePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProfileBody />
    </Suspense>
  );
}

async function ProfileBody() {
  const { profile } = await loadEditor();
  return (
    <div>
      <PageHeader title="Profile">Your header and what you&apos;re looking for.</PageHeader>
      <ProfileForm profile={profile} aiEnabled={aiEnabled()} />
    </div>
  );
}
