"use client";

import { useActionState, useId, useState, useTransition } from "react";

import { draftProfileSummary, saveProfile, type ActionResult } from "@/app/(app)/dashboard/actions";
import { FormStatus } from "@/components/dashboard/action-button";
import type { Profile } from "@/db/schema";
import { ROLE_TYPES, WORK_MODE_LABEL } from "@/lib/insights";

type Editable = Pick<
  Profile,
  | "username"
  | "displayName"
  | "headline"
  | "summary"
  | "summarySource"
  | "location"
  | "timezone"
  | "openToWork"
  | "roleTypes"
  | "workMode"
  | "workAuthorization"
  | "contactEmail"
  | "links"
  | "goals"
>;

export function ProfileForm({ profile, aiEnabled, appHost }: { profile: Editable; aiEnabled: boolean; appHost: string }) {
  const id = useId();
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(saveProfile, null);
  const [headline, setHeadline] = useState(profile.headline ?? "");
  const [summary, setSummary] = useState(profile.summary ?? "");
  const [summarySource, setSummarySource] = useState(profile.summarySource ?? "");
  const [drafting, startDraft] = useTransition();
  const [draftError, setDraftError] = useState<string | null>(null);

  const f = (name: string) => `${id}-${name}`;

  return (
    <form action={formAction} className="space-y-6">
      <section className="surface space-y-4 p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[1.4rem] text-fg">The 60-second header</h2>
            <p className="text-[14px] text-fg-2">What a recruiter reads before scrolling.</p>
          </div>
          {aiEnabled ? (
            <div className="flex flex-col items-end gap-1">
              <button
                type="button"
                className="btn-secondary h-9 rounded-lg px-3.5 text-[14px]"
                disabled={drafting}
                onClick={() =>
                  startDraft(async () => {
                    setDraftError(null);
                    const draft = await draftProfileSummary();
                    if (draft.ok) {
                      setHeadline(draft.headline);
                      setSummary(draft.summary);
                      setSummarySource("ai");
                    } else {
                      setDraftError(draft.error);
                    }
                  })
                }
              >
                {drafting ? "Drafting…" : "Draft with AI"}
              </button>
              {draftError ? <span className="text-[13px] text-red-700">{draftError}</span> : null}
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor={f("name")}>
              Name
            </label>
            <input id={f("name")} name="displayName" defaultValue={profile.displayName ?? ""} maxLength={100} className="field" />
          </div>
          <div>
            <label className="label" htmlFor={f("username")}>
              Your link
            </label>
            <div className="flex items-center rounded-[0.65rem] border border-ink/14 bg-panel pl-3 focus-within:border-ink/45">
              <span className="shrink-0 text-[14px] text-fg-3">{appHost}/in/@</span>
              <input
                id={f("username")}
                name="username"
                required
                defaultValue={profile.username}
                pattern="[a-z0-9](?:[a-z0-9\-]{0,37}[a-z0-9])?"
                className="field rounded-l-none border-0 focus:shadow-none"
              />
            </div>
          </div>
        </div>
        <div>
          <label className="label" htmlFor={f("headline")}>
            Headline
          </label>
          <input
            id={f("headline")}
            name="headline"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            maxLength={120}
            className="field"
            placeholder="Backend engineer · Go & PostgreSQL · 4 yrs"
          />
        </div>
        <div>
          <label className="label" htmlFor={f("summary")}>
            Summary <span className="font-normal text-fg-3">· 3 sentences: what you build, your level, what you want next</span>
          </label>
          <textarea
            id={f("summary")}
            name="summary"
            rows={4}
            value={summary}
            onChange={(e) => {
              setSummary(e.target.value);
              setSummarySource("user");
            }}
            maxLength={800}
            className="field"
          />
          <input type="hidden" name="summarySource" value={summarySource} />
          {summarySource === "ai" ? <p className="mt-1 text-[12px] text-fg-3">AI draft. Check every claim before you save.</p> : null}
        </div>
      </section>

      <section className="surface space-y-4 p-5 md:p-6">
        <div>
          <h2 className="text-[1.4rem] text-fg">What you&apos;re looking for</h2>
          <p className="text-[14px] text-fg-2">Shapes the AI summary and tells recruiters if you fit.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor={f("role")}>
              Target role
            </label>
            <input id={f("role")} name="targetRole" defaultValue={profile.goals.targetRole ?? ""} className="field" placeholder="Backend engineer" />
          </div>
          <div>
            <label className="label" htmlFor={f("level")}>
              Level
            </label>
            <input id={f("level")} name="targetLevel" defaultValue={profile.goals.targetLevel ?? ""} className="field" placeholder="Mid-level" />
          </div>
          <div>
            <label className="label" htmlFor={f("market")}>
              Market
            </label>
            <input id={f("market")} name="targetMarket" defaultValue={profile.goals.targetMarket ?? ""} className="field" placeholder="Remote, EU timezones" />
          </div>
        </div>

        <label className="flex items-center gap-2.5 text-[15px] text-fg">
          <input type="checkbox" name="openToWork" defaultChecked={profile.openToWork} className="size-4" />
          Open to work
        </label>
        <fieldset>
          <legend className="label">Role types</legend>
          <div className="flex flex-wrap gap-2">
            {ROLE_TYPES.map((r) => (
              <label key={r} className="chip cursor-pointer bg-card">
                <input type="checkbox" name="roleTypes" value={r} defaultChecked={profile.roleTypes.includes(r)} />
                {r}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor={f("mode")}>
              Work mode
            </label>
            <select id={f("mode")} name="workMode" defaultValue={profile.workMode ?? ""} className="field">
              <option value="">Not set</option>
              {Object.entries(WORK_MODE_LABEL).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor={f("auth")}>
              Work authorization <span className="font-normal text-fg-3">· optional</span>
            </label>
            <input id={f("auth")} name="workAuthorization" defaultValue={profile.workAuthorization ?? ""} className="field" placeholder="EU citizen" />
          </div>
          <div>
            <label className="label" htmlFor={f("loc")}>
              Location
            </label>
            <input id={f("loc")} name="location" defaultValue={profile.location ?? ""} className="field" placeholder="Porto, Portugal" />
          </div>
          <div>
            <label className="label" htmlFor={f("tz")}>
              Timezone
            </label>
            <input id={f("tz")} name="timezone" defaultValue={profile.timezone ?? ""} className="field" placeholder="UTC+0" />
          </div>
        </div>
      </section>

      <section className="surface space-y-4 p-5 md:p-6">
        <div>
          <h2 className="text-[1.4rem] text-fg">Contact and links</h2>
          <p className="text-[14px] text-fg-2">Leave the email empty to hide the Contact button.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor={f("email")}>
              Contact email
            </label>
            <input id={f("email")} type="email" name="contactEmail" defaultValue={profile.contactEmail ?? ""} className="field" />
          </div>
          <div>
            <label className="label" htmlFor={f("li")}>
              LinkedIn URL
            </label>
            <input id={f("li")} name="linkedin" defaultValue={profile.links.linkedin ?? ""} className="field" placeholder="linkedin.com/in/you" />
          </div>
          <div>
            <label className="label" htmlFor={f("web")}>
              Website
            </label>
            <input id={f("web")} name="website" defaultValue={profile.links.website ?? ""} className="field" />
          </div>
        </div>
      </section>

      <div className="sticky bottom-4 z-10 flex items-center gap-3 rounded-xl border border-line bg-page/90 p-3 backdrop-blur">
        <button type="submit" className="btn-primary h-10 rounded-lg px-5 text-[15px]" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}
