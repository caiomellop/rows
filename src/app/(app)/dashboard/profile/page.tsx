import type { Metadata } from "next";
import { Suspense } from "react";

import { loadEditor } from "@/app/(app)/dashboard/load";
import { PageHeader, PageSkeleton } from "@/app/(app)/dashboard/skeleton";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { aiEnabled } from "@/lib/ai";
import { siteHost } from "@/lib/app-url";

export const metadata: Metadata = { title: "Profile · Rows" };

export default function ProfilePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProfileBody />
    </Suspense>
  );
}

async function ProfileBody() {
  const { profile } = await loadEditor();
  const appHost = siteHost();
  return (
    <div>
      <PageHeader title="Profile">Your header, what you&apos;re looking for, and how recruiters reach you.</PageHeader>
      <ProfileForm
        profile={profile}
        aiEnabled={aiEnabled()}
        appHost={appHost}
      />
    </div>
  );
}
