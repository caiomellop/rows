import type { Metadata } from "next";
import { Suspense } from "react";

import { loadViewer } from "@/app/(app)/dashboard/load";
import { PageHeader, PageSkeleton } from "@/app/(app)/dashboard/skeleton";

export const metadata: Metadata = { title: "Memory · Rows" };

export default function MemoryPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Body />
    </Suspense>
  );
}

/** Placeholder until the memory panel (MVP-27) is built. */
async function Body() {
  await loadViewer();
  return (
    <div>
      <PageHeader title="Memory">What the AI knows about you: your goals, your experience and how you like to be described.</PageHeader>
      <p className="surface p-5 text-[14px] leading-relaxed text-fg-2">
        <span className="chip mr-2">Soon</span>
        This page is on its way. For now, everything you tell the AI in a chat stays in that conversation.
      </p>
    </div>
  );
}
