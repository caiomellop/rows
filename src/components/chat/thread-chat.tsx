"use client";

import { Pin, PinOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { saveChatToCv, sendChatMessage, setThreadPinned, type ActionResult } from "@/app/(app)/dashboard/actions";
import type { AssistantMessage } from "@/db/schema";

type Props = { threadId: string; title: string; pinned: boolean; initial: AssistantMessage[]; aiEnabled: boolean };

/** One conversation with the assistant. */
export function ThreadChat({ threadId, title, pinned: initialPinned, initial, aiEnabled }: Props) {
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<ActionResult | null>(null);
  const [pinned, setPinned] = useState(initialPinned);
  const [pending, startTransition] = useTransition();
  const [saving, startSave] = useTransition();
  const [pinning, startPin] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const asked = useRef(false);
  const router = useRouter();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, pending]);

  function send(text: string) {
    setError(null);
    setSaved(null);
    if (text) setMessages((m) => [...m, { role: "user", content: text }]);
    setDraft("");
    startTransition(async () => {
      try {
        const result = await sendChatMessage(threadId, text);
        setMessages(result.messages);
        if (!result.ok) setError(result.error);
      } catch {
        setError("Something went wrong. Refresh and try again.");
      }
    });
  }

  // A chat opened from the composer or a starter arrives with the first
  // message already stored and no reply yet: ask for the reply once.
  const awaitingReply = initial.at(-1)?.role === "user";
  useEffect(() => {
    if (!awaitingReply || asked.current) return;
    asked.current = true;
    // A redirect from the composer does not re-render the layout: ask for it,
    // so the sidebar lists this new conversation.
    router.refresh();
    if (!aiEnabled) return;
    startTransition(async () => {
      try {
        const result = await sendChatMessage(threadId, "");
        setMessages(result.messages);
        if (!result.ok) setError(result.error);
      } catch {
        setError("Something went wrong. Refresh and try again.");
      }
    });
  }, [awaitingReply, aiEnabled, threadId, router]);

  const hasAnswers = messages.some((m) => m.role === "user");

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-4 flex items-center gap-2">
        <h1 className="min-w-0 flex-1 truncate font-sans text-[17px] font-medium text-fg">{title}</h1>
        <button
          type="button"
          aria-pressed={pinned}
          disabled={pinning}
          title={pinned ? "Unpin from the sidebar" : "Pin to the sidebar"}
          className="btn-secondary h-9 rounded-lg px-3 text-[14px]"
          onClick={() =>
            startPin(async () => {
              const next = !pinned;
              const result = await setThreadPinned(threadId, next);
              if (result.ok) setPinned(next);
              else setError(result.error);
            })
          }
        >
          {pinned ? <PinOff aria-hidden size={15} strokeWidth={1.6} /> : <Pin aria-hidden size={15} strokeWidth={1.6} />}
          {pinned ? "Unpin" : "Pin"}
        </button>
      </div>

      <div className="surface flex min-h-[60vh] flex-1 flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-5" aria-live="polite">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <p
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
                  m.role === "user" ? "bg-ink text-page" : "bg-panel text-fg"
                }`}
              >
                <span className="sr-only">{m.role === "user" ? "You: " : "Assistant: "}</span>
                {m.content}
              </p>
            </div>
          ))}
          {pending ? (
            <div className="flex justify-start">
              <p className="rounded-2xl bg-panel px-4 py-2.5 text-[15px] text-fg-3">Thinking…</p>
            </div>
          ) : null}
          <div ref={endRef} />
        </div>

        {error ? (
          <p role="alert" className="px-5 pb-2 text-[13px] text-red-700 dark:text-red-400">
            {error}
          </p>
        ) : null}
        {!aiEnabled ? <p className="px-5 pb-2 text-[13px] text-fg-3">The assistant needs ANTHROPIC_API_KEY to be set.</p> : null}

        <form
          className="flex items-end gap-2 border-t border-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim() && !pending) send(draft.trim());
          }}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (draft.trim() && !pending) send(draft.trim());
              }
            }}
            rows={2}
            disabled={!aiEnabled}
            placeholder="Your message… (Enter to send, Shift+Enter for a new line)"
            aria-label="Your message"
            className="field flex-1 resize-none"
          />
          <button type="submit" className="btn-primary h-10 rounded-lg px-4 text-[14px]" disabled={!aiEnabled || pending || !draft.trim()}>
            Send
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-3">
          <button
            type="button"
            className="btn-secondary h-9 rounded-lg px-4 text-[14px]"
            disabled={!aiEnabled || !hasAnswers || saving || pending}
            onClick={() =>
              startSave(async () => {
                setSaved(await saveChatToCv(threadId));
              })
            }
          >
            {saving ? "Writing your CV…" : "Save to my CV"}
          </button>
          {saved ? (
            saved.ok ? (
              <span role="status" className="text-[13px] text-fg-2">
                {saved.message}{" "}
                <Link href="/dashboard/experience" className="underline underline-offset-2">
                  Review
                </Link>
              </span>
            ) : (
              <span role="alert" className="text-[13px] text-red-700 dark:text-red-400">
                {saved.error}
              </span>
            )
          ) : (
            <span className="text-[13px] text-fg-3">Turns what you said here into resume entries you can edit.</span>
          )}
        </div>
      </div>
    </div>
  );
}
