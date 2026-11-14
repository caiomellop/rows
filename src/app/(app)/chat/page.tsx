import type { Metadata } from "next";
import { Suspense } from "react";

import { loadViewer } from "@/app/(app)/dashboard/load";
import { PageSkeleton } from "@/app/(app)/dashboard/skeleton";
import { NewChat } from "@/components/chat/new-chat";
import { aiEnabled } from "@/lib/ai";

export const metadata: Metadata = { title: "New chat · Rows" };

export default function NewChatPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Body />
    </Suspense>
  );
}

async function Body() {
  const { profile } = await loadViewer();
  const firstName = profile.displayName?.trim().split(/\s+/)[0];
  return <NewChat greeting={firstName ? `What are we working on, ${firstName}?` : "What are we working on?"} aiEnabled={aiEnabled()} />;
}
