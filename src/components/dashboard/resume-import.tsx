"use client";

import { useActionState, useState } from "react";

import { importResume, type ActionResult } from "@/app/(app)/dashboard/actions";
import { FormStatus } from "@/components/dashboard/action-button";

const SOURCES = [
  { value: "resume", label: "Resume", hint: "PDF, DOCX or TXT." },
  {
    value: "linkedin",
    label: "LinkedIn",
    hint: "On your LinkedIn profile: Resources → Save to PDF. Or upload Positions.csv from Settings → Data privacy → Get a copy of your data.",
  },
] as const;

export function ResumeImport({ aiEnabled }: { aiEnabled: boolean }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(importResume, null);
  const [source, setSource] = useState<(typeof SOURCES)[number]["value"]>("resume");

  if (!aiEnabled) {
    return <p className="text-[14px] text-fg-3">Import needs AI. Set ANTHROPIC_API_KEY, or add entries by hand below.</p>;
  }

  return (
    <form action={formAction} className="space-y-4">
      <fieldset className="flex flex-wrap gap-2">
        <legend className="label">Import from</legend>
        {SOURCES.map((s) => (
          <label
            key={s.value}
            className={`cursor-pointer rounded-lg border px-3 py-1.5 text-[14px] ${
              source === s.value ? "border-ink/40 bg-ink/[0.06] text-fg" : "border-line text-fg-2"
            }`}
          >
            <input
              type="radio"
              name="source"
              value={s.value}
              checked={source === s.value}
              onChange={() => setSource(s.value)}
              className="sr-only"
            />
            {s.label}
          </label>
        ))}
      </fieldset>
      <p className="text-[13px] leading-relaxed text-fg-3">{SOURCES.find((s) => s.value === source)?.hint}</p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          name="file"
          required
          accept=".pdf,.docx,.txt,.md,.csv,application/pdf"
          aria-label="Resume file"
          className="text-[14px] text-fg-2 file:mr-3 file:rounded-lg file:border file:border-ink/15 file:bg-ink/5 file:px-3 file:py-1.5 file:text-[14px] file:font-medium file:text-fg"
        />
        <button type="submit" className="btn-primary h-9 rounded-lg px-4 text-[14px]" disabled={pending}>
          {pending ? "Reading your file…" : "Import"}
        </button>
      </div>
      <FormStatus state={state} />
      <p className="text-[12px] text-fg-3">Rows copies what the file says. Nothing is added or embellished, and you can edit every entry.</p>
    </form>
  );
}
