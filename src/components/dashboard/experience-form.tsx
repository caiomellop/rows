"use client";

import { useActionState, useId, useState } from "react";

import { deleteExperience, saveExperience, type ActionResult } from "@/app/(app)/dashboard/actions";
import { ActionButton, FormStatus } from "@/components/dashboard/action-button";
import type { Experience } from "@/db/schema";

/** Month inputs need "YYYY-MM"; a bare year becomes January. */
const toMonth = (v: string | null) => (v ? (v.length === 4 ? `${v}-01` : v) : "");

export function ExperienceForm({ experience, onDone }: { experience?: Experience; onDone?: () => void }) {
  const id = useId();
  const [current, setCurrent] = useState(experience?.current ?? false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(async (prev, fd) => {
    const result = await saveExperience(prev, fd);
    if (result.ok) onDone?.();
    return result;
  }, null);

  return (
    <form action={formAction} className="space-y-4">
      {experience ? <input type="hidden" name="id" value={experience.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-[140px_1fr_1fr]">
        <div>
          <label className="label" htmlFor={`${id}-kind`}>
            Type
          </label>
          <select id={`${id}-kind`} name="kind" defaultValue={experience?.kind ?? "work"} className="field">
            <option value="work">Work</option>
            <option value="education">Education</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`${id}-title`}>
            Title or degree
          </label>
          <input id={`${id}-title`} name="title" required defaultValue={experience?.title} className="field" placeholder="Backend engineer" />
        </div>
        <div>
          <label className="label" htmlFor={`${id}-org`}>
            Company or school
          </label>
          <input id={`${id}-org`} name="organization" required defaultValue={experience?.organization} className="field" placeholder="Acme" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor={`${id}-start`}>
            Start
          </label>
          <input id={`${id}-start`} type="month" name="startDate" defaultValue={toMonth(experience?.startDate ?? null)} className="field" />
        </div>
        <div>
          <label className="label" htmlFor={`${id}-end`}>
            End
          </label>
          <input
            id={`${id}-end`}
            type="month"
            name="endDate"
            disabled={current}
            defaultValue={toMonth(experience?.endDate ?? null)}
            className="field disabled:opacity-50"
          />
          <label className="mt-2 flex items-center gap-2 text-[13px] text-fg-2">
            <input type="checkbox" name="current" checked={current} onChange={(e) => setCurrent(e.target.checked)} />
            I work here now
          </label>
        </div>
        <div>
          <label className="label" htmlFor={`${id}-loc`}>
            Location
          </label>
          <input id={`${id}-loc`} name="location" defaultValue={experience?.location ?? ""} className="field" placeholder="Lisbon · Remote" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor={`${id}-bullets`}>
          What you did (one per line)
        </label>
        <textarea
          id={`${id}-bullets`}
          name="bullets"
          rows={4}
          defaultValue={experience?.bullets.join("\n")}
          className="field"
          placeholder={"Built the payments service in Go, used by 40k customers\nCut CI time from 25 to 8 minutes"}
        />
      </div>
      <div>
        <label className="label" htmlFor={`${id}-skills`}>
          Skills (comma-separated)
        </label>
        <input id={`${id}-skills`} name="skills" defaultValue={experience?.skills.join(", ")} className="field" placeholder="Go, PostgreSQL, Kubernetes" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary h-9 rounded-lg px-4 text-[14px]" disabled={pending}>
          {pending ? "Saving…" : experience ? "Save" : "Add entry"}
        </button>
        {experience ? (
          <ActionButton
            action={deleteExperience.bind(null, experience.id)}
            confirm={`Delete ${experience.title} at ${experience.organization}?`}
            className="h-9 rounded-lg px-3 text-[14px] text-red-700 hover:bg-red-50"
          >
            Delete
          </ActionButton>
        ) : null}
        <FormStatus state={state} />
      </div>
    </form>
  );
}

export function NewExperience() {
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState(0);
  if (!open) {
    return (
      <button type="button" className="btn-secondary h-9 rounded-lg px-4 text-[14px]" onClick={() => setOpen(true)}>
        Add an entry by hand
      </button>
    );
  }
  return (
    <div className="surface p-5">
      <ExperienceForm
        key={version}
        onDone={() => {
          setVersion((v) => v + 1);
          setOpen(false);
        }}
      />
    </div>
  );
}
