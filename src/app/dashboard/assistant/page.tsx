import type { Metadata } from "next";
import { Suspense } from "react";

import { loadEditor } from "@/app/dashboard/load";
import { PageHeader, PageSkeleton } from "@/app/dashboard/skeleton";
import { AssistantChat } from "@/components/dashboard/assistant-chat";
import { aiEnabled } from "@/lib/ai";

export const metadata: Metadata = { title: "AI assistant · Rows" };

export default function AssistantPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AssistantBody />
    </Suspense>
  );
}

async function AssistantBody() {
  const { thread } = await loadEditor();
  return (
    <div>
      <PageHeader title="AI career assistant">
        A short interview that turns your answers into a strong CV. Press <span className="text-fg">Save to my CV</span> when
        you&apos;re done; you can edit everything afterwards.
      </PageHeader>
      {aiEnabled() ? (
        <AssistantChat initial={thread} />
      ) : (
        <p className="surface p-5 text-[14px] text-fg-2">The assistant needs ANTHROPIC_API_KEY to be set.</p>
      )}
    </div>
  );
}
