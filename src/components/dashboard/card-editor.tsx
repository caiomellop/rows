"use client";

import { useActionState, useId } from "react";

import type { ActionResult } from "@/app/(app)/dashboard/actions";
import { ActionButton, FormStatus } from "@/components/dashboard/action-button";
import type { ProjectCard } from "@/db/schema";

const SOURCE_LABEL: Record<string, string> = {
  readme: "README",
  languages: "languages",
  commits: "commit history",
  dependencies: "dependencies",
  description: "repo description",
  topics: "topics",
};

/** Draft with AI → edit → approve. Only approved cards are public (plan §3.2). */
export function CardEditor({
  card,
  status,
  aiEnabled,
  draft,
  save,
}: {
  card: ProjectCard | null;
  status: "none" | "draft" | "approved";
  aiEnabled: boolean;
  draft: () => Promise<ActionResult>;
  save: (formData: FormData) => Promise<ActionResult>;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>((_prev, fd) => save(fd), null);
  const id = useId();

  const draftButton = aiEnabled ? (
    <ActionButton action={draft} pendingLabel="Reading the repo…" showMessage={false}>
      {card ? "Redraft with AI" : "Draft card with AI"}
    </ActionButton>
  ) : null;

  if (!card) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-ink/15 p-4">
        <p className="flex-1 text-[14px] text-fg-2">
          No card yet. {aiEnabled ? "AI writes one from the README, languages and commits. You review it before it goes public." : "Write one sentence about what this project is."}
        </p>
        {draftButton}
        {!aiEnabled ? <ManualCard formAction={formAction} pending={pending} state={state} /> : null}
      </div>
    );
  }

  const highlights = [0, 1, 2].map((i) => card.highlights[i]);

  return (
    <form action={formAction} className="space-y-3 rounded-xl bg-panel/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`chip ${status === "approved" ? "bg-card text-fg" : ""}`}>
          {status === "approved" ? "Approved · public" : "Draft · not public yet"}
        </span>
        {draftButton}
      </div>
      <div>
        <label className="label" htmlFor={`${id}-what`}>
          What it is (one plain sentence)
        </label>
        <textarea id={`${id}-what`} name="whatItIs" defaultValue={card.whatItIs} rows={2} required maxLength={300} className="field" />
      </div>
      {highlights.map((h, i) => (
        <div key={i}>
          <label className="label" htmlFor={`${id}-h${i}`}>
            Highlight {i + 1}
            {h ? <span className="font-normal text-fg-3"> · from the {SOURCE_LABEL[h.source] ?? h.source}</span> : null}
          </label>
          <input id={`${id}-h${i}`} name={`highlight-${i}`} defaultValue={h?.text ?? ""} maxLength={200} className="field" placeholder="Optional" />
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button type="submit" className="btn-primary h-9 rounded-lg px-4 text-[14px]" disabled={pending}>
          {pending ? "Saving…" : status === "approved" ? "Save changes" : "Approve card"}
        </button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}

function ManualCard({
  formAction,
  pending,
  state,
}: {
  formAction: (fd: FormData) => void;
  pending: boolean;
  state: ActionResult | null;
}) {
  return (
    <form action={formAction} className="w-full space-y-2">
      <textarea name="whatItIs" rows={2} required maxLength={300} className="field" placeholder="A booking system for a dental clinic, used in production." />
      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary h-9 rounded-lg px-4 text-[14px]" disabled={pending}>
          {pending ? "Saving…" : "Save card"}
        </button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}
