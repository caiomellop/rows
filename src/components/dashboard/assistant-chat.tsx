"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

import { resetInterview, saveInterviewToCv, sendInterviewMessage, type ActionResult } from "@/app/dashboard/actions";
import type { AssistantMessage } from "@/db/schema";

export function AssistantChat({ initial }: { initial: AssistantMessage[] }) {
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [saving, startSave] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

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
        const result = await sendInterviewMessage(text);
        setMessages(result.messages);
        if (!result.ok) setError(result.error);
      } catch {
        setError("Something went wrong. Refresh and try again.");
      }
    });
  }

  const hasAnswers = messages.some((m) => m.role === "user");

  return (
    <div className="surface flex min-h-[60vh] flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-5" aria-live="polite">
        {messages.length === 0 && !pending ? (
          <div className="mx-auto max-w-md py-10 text-center">
            <p className="text-[15px] leading-relaxed text-fg-2">
              The assistant asks about your goals, then each job and project, one at a time. It writes CV bullets from your
              answers and never invents numbers or experience.
            </p>
            <button type="button" className="btn-primary mt-5 h-10 rounded-lg px-5 text-[15px]" onClick={() => send("")}>
              Start the interview
            </button>
          </div>
        ) : null}
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
        <p role="alert" className="px-5 pb-2 text-[13px] text-red-700">
          {error}
        </p>
      ) : null}

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
          placeholder={messages.length ? "Your answer… (Enter to send, Shift+Enter for a new line)" : "Or just say hi"}
          aria-label="Your message"
          className="field flex-1 resize-none"
        />
        <button type="submit" className="btn-primary h-10 rounded-lg px-4 text-[14px]" disabled={pending || !draft.trim()}>
          Send
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-3">
        <button
          type="button"
          className="btn-secondary h-9 rounded-lg px-4 text-[14px]"
          disabled={!hasAnswers || saving || pending}
          onClick={() =>
            startSave(async () => {
              setSaved(await saveInterviewToCv());
            })
          }
        >
          {saving ? "Writing your CV…" : "Save to my CV"}
        </button>
        <button
          type="button"
          className="h-9 rounded-lg px-3 text-[14px] text-fg-3 hover:text-fg"
          disabled={pending || messages.length === 0}
          onClick={() => {
            if (!window.confirm("Start over? This clears the conversation, not your CV.")) return;
            startTransition(async () => {
              await resetInterview();
              setMessages([]);
              setSaved(null);
            });
          }}
        >
          Start over
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
            <span role="alert" className="text-[13px] text-red-700">
              {saved.error}
            </span>
          )
        ) : null}
      </div>
    </div>
  );
}
