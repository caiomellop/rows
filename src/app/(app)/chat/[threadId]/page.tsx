import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { loadViewer } from "@/app/(app)/dashboard/load";
import { PageSkeleton } from "@/app/(app)/dashboard/skeleton";
import { ThreadChat } from "@/components/chat/thread-chat";
import { aiEnabled } from "@/lib/ai";
import { getThread } from "@/lib/dal";

export const metadata: Metadata = { title: "Chat · Rows" };

export default function ThreadPage({ params }: PageProps<"/chat/[threadId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Body params={params} />
    </Suspense>
  );
}

async function Body({ params }: Pick<PageProps<"/chat/[threadId]">, "params">) {
  const [{ threadId }, { user }] = await Promise.all([params, loadViewer()]);
  const thread = await getThread(user.id, threadId);
  if (!thread) notFound();
  // Keyed by thread so moving between conversations starts from fresh state.
  return (
    <ThreadChat
      key={thread.id}
      threadId={thread.id}
      title={thread.title}
      pinned={thread.pinned}
      initial={thread.messages}
      aiEnabled={aiEnabled()}
    />
  );
}
