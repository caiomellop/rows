"use client";

import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  createProject,
  saveExperience,
  syncRepos,
  updateProfile,
  type FormState,
} from "@/app/dashboard/actions";
import type { PortfolioExperience, PortfolioProfile, PortfolioProject } from "@/lib/portfolio";

export const inputClass =
  "w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-[15px] text-fg shadow-[0_1px_2px_rgba(0,0,0,0.03)] placeholder:text-fg-3 transition-[border-color,box-shadow] focus:border-ink/30 focus:outline-none focus:ring-4 focus:ring-ink/[0.06] aria-invalid:border-red-700/50 disabled:bg-panel disabled:text-fg-3";

/* ----------------------------------------------------------------- Pieces */

/** Submit button that shows a pending label while its form's action runs. */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const { pending } = useFormStatus();
  const base =
    variant === "primary"
      ? "btn-primary h-10 rounded-xl px-4 text-[14px]"
      : variant === "secondary"
        ? "btn-secondary h-10 rounded-xl px-4 text-[14px]"
        : "inline-flex h-8 items-center rounded-lg px-2.5 text-[13px] font-medium text-fg-2 transition-colors hover:bg-ink/[0.06] hover:text-fg";
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${base} disabled:cursor-wait disabled:opacity-60 ${className}`}
      {...rest}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

function Field({
  label,
  name,
  hint,
  error,
  children,
}: {
  label: string;
  name: string;
  hint?: React.ReactNode;
  error?: string;
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => React.ReactNode;
}) {
  const id = `${useId()}-${name}`;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-fg-2">
        {label}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {error ? (
        <p id={`${id}-error`} className="text-[13px] text-red-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[13px] text-fg-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Status({ state }: { state: FormState }) {
  if (!state.message) return null;
  return (
    <p
      role="status"
      className={`text-[13px] ${state.ok ? "text-fg-2" : "text-red-700"}`}
    >
      {state.message}
    </p>
  );
}

function value(state: FormState, key: string, fallback: string | null | undefined) {
  const v = state.values?.[key];
  return typeof v === "string" ? v : (fallback ?? "");
}

/* ---------------------------------------------------------------- Profile */

export function ProfileForm({ profile, origin }: { profile: PortfolioProfile; origin: string }) {
  const [state, action] = useActionState(updateProfile, {});
  const e = state.errors ?? {};

  return (
    <form action={action} className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" name="name" error={e.name}>
          {(p) => (
            <input
              {...p}
              name="name"
              defaultValue={value(state, "name", profile.name)}
              autoComplete="name"
              className={inputClass}
            />
          )}
        </Field>
        <Field
          label="Username"
          name="username"
          error={e.username}
          hint={`${origin.replace(/^https?:\/\//, "")}/u/${value(state, "username", profile.username) || "you"}`}
        >
          {(p) => (
            <input
              {...p}
              name="username"
              defaultValue={value(state, "username", profile.username)}
              required
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={inputClass}
            />
          )}
        </Field>
      </div>

      <Field label="Headline" name="headline" error={e.headline} hint="One line under your name.">
        {(p) => (
          <input
            {...p}
            name="headline"
            defaultValue={value(state, "headline", profile.headline)}
            placeholder="Full-stack engineer building tools for small teams"
            maxLength={140}
            className={inputClass}
          />
        )}
      </Field>

      <Field
        label="About"
        name="about"
        error={e.about}
        hint="A few short paragraphs. Leave a blank line between them."
      >
        {(p) => (
          <textarea
            {...p}
            name="about"
            defaultValue={value(state, "about", profile.about)}
            rows={6}
            maxLength={4000}
            placeholder="What you work on, what you care about, what you're looking for next."
            className={`${inputClass} resize-y leading-relaxed`}
          />
        )}
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Location" name="location" error={e.location}>
          {(p) => (
            <input
              {...p}
              name="location"
              defaultValue={value(state, "location", profile.location)}
              placeholder="Lisbon, Portugal"
              className={inputClass}
            />
          )}
        </Field>
        <Field label="Website" name="website" error={e.website}>
          {(p) => (
            <input
              {...p}
              name="website"
              defaultValue={value(state, "website", profile.website)}
              placeholder="yoursite.com"
              inputMode="url"
              autoCapitalize="none"
              className={inputClass}
            />
          )}
        </Field>
      </div>

      <div className="flex items-center gap-4">
        <SubmitButton pendingLabel="Saving…">Save profile</SubmitButton>
        <Status state={state} />
      </div>
    </form>
  );
}

/* --------------------------------------------------------------- Projects */

export function SyncButton() {
  const [state, action] = useActionState(syncRepos, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <SubmitButton variant="secondary" pendingLabel="Syncing…">
        Sync GitHub
      </SubmitButton>
      <Status state={state} />
      {state.message && !state.ok && /sign in/i.test(state.message) ? (
        <a href="/auth" className="text-[13px] font-medium text-fg underline underline-offset-4">
          Reconnect
        </a>
      ) : null}
    </form>
  );
}

export function NewProjectForm() {
  const [state, action] = useActionState(createProject, {});
  const e = state.errors ?? {};
  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" name="name" error={e.name}>
          {(p) => (
            <input {...p} name="name" defaultValue={value(state, "name", "")} required className={inputClass} />
          )}
        </Field>
        <Field label="Link" name="url" error={e.url}>
          {(p) => (
            <input
              {...p}
              name="url"
              defaultValue={value(state, "url", "")}
              placeholder="example.com"
              inputMode="url"
              autoCapitalize="none"
              className={inputClass}
            />
          )}
        </Field>
      </div>
      <Field label="Description" name="description" error={e.description}>
        {(p) => (
          <input
            {...p}
            name="description"
            defaultValue={value(state, "description", "")}
            maxLength={400}
            className={inputClass}
          />
        )}
      </Field>
      <div className="flex items-center gap-4">
        <SubmitButton pendingLabel="Adding…">Add project</SubmitButton>
        <Status state={state} />
      </div>
    </form>
  );
}

/* ------------------------------------------------------------ Experiences */

export function ExperienceForm({
  experience,
  projects,
  onDone,
}: {
  experience?: PortfolioExperience;
  projects: PortfolioProject[];
  onDone?: () => void;
}) {
  const initialCurrent = experience ? !experience.endDate : false;
  const [current, setCurrent] = useState(initialCurrent);
  const [state, action] = useActionState(async (prev: FormState, formData: FormData) => {
    const next = await saveExperience(prev, formData);
    // React resets the form's fields after the action; the controlled checkbox
    // has to be reset by hand to match.
    if (next.ok) {
      setCurrent(initialCurrent);
      onDone?.();
    }
    return next;
  }, {});
  const e = state.errors ?? {};
  const linked = new Set(
    Array.isArray(state.values?.projectIds) ? state.values.projectIds : (experience?.projectIds ?? []),
  );
  // Offer visible projects, plus any hidden one that is already linked.
  const options = projects.filter((p) => p.visible || linked.has(p.id));

  return (
    <form action={action} className="grid gap-4">
      {experience ? <input type="hidden" name="id" value={experience.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Role" name="role" error={e.role}>
          {(p) => (
            <input
              {...p}
              name="role"
              defaultValue={value(state, "role", experience?.role)}
              placeholder="Senior Engineer"
              required
              className={inputClass}
            />
          )}
        </Field>
        <Field label="Company" name="company" error={e.company}>
          {(p) => (
            <input
              {...p}
              name="company"
              defaultValue={value(state, "company", experience?.company)}
              placeholder="Acme"
              required
              className={inputClass}
            />
          )}
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Start" name="startDate" error={e.startDate}>
          {(p) => (
            <input
              {...p}
              type="month"
              name="startDate"
              defaultValue={value(state, "startDate", experience?.startDate)}
              required
              className={inputClass}
            />
          )}
        </Field>
        <Field label="End" name="endDate" error={e.endDate}>
          {(p) => (
            <input
              {...p}
              type="month"
              name="endDate"
              defaultValue={value(state, "endDate", experience?.endDate)}
              disabled={current}
              className={inputClass}
            />
          )}
        </Field>
        <Field label="Location" name="location" error={e.location}>
          {(p) => (
            <input
              {...p}
              name="location"
              defaultValue={value(state, "location", experience?.location)}
              placeholder="Remote"
              className={inputClass}
            />
          )}
        </Field>
      </div>

      <label className="flex w-fit items-center gap-2 text-[14px] text-fg-2">
        <input
          type="checkbox"
          name="current"
          checked={current}
          onChange={(ev) => setCurrent(ev.target.checked)}
          className="size-4 accent-[rgb(var(--ink))]"
        />
        I work here now
      </label>

      <Field label="What you did" name="description" error={e.description}>
        {(p) => (
          <textarea
            {...p}
            name="description"
            defaultValue={value(state, "description", experience?.description)}
            rows={4}
            maxLength={2000}
            placeholder="Scope, impact, what you shipped."
            className={`${inputClass} resize-y leading-relaxed`}
          />
        )}
      </Field>

      {options.length > 0 ? (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-[13px] font-medium text-fg-2">Related projects</legend>
          <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
            {options.map((project) => (
              <label key={project.id} className="cursor-pointer">
                <input
                  type="checkbox"
                  name="projectIds"
                  value={project.id}
                  defaultChecked={linked.has(project.id)}
                  className="peer sr-only"
                />
                <span className="inline-flex rounded-full border border-line px-3 py-1 text-[13px] text-fg-2 transition-colors peer-checked:border-ink peer-checked:bg-ink peer-checked:text-page peer-focus-visible:ring-2 peer-focus-visible:ring-ink/30">
                  {project.name}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className="flex items-center gap-4">
        <SubmitButton pendingLabel="Saving…">
          {experience ? "Save changes" : "Add experience"}
        </SubmitButton>
        {onDone ? (
          <button
            type="button"
            onClick={onDone}
            className="text-[14px] font-medium text-fg-2 hover:text-fg"
          >
            Cancel
          </button>
        ) : null}
        <Status state={state} />
      </div>
    </form>
  );
}

/** An experience row's inline editor, toggled open by an "Edit" button. */
export function EditExperience({
  experience,
  projects,
  children,
  actions,
}: {
  experience: PortfolioExperience;
  projects: PortfolioProject[];
  children: React.ReactNode;
  /** Extra buttons next to "Edit", e.g. a server-rendered delete form. */
  actions?: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <div className="rounded-[18px] border border-line bg-page p-5">
        <ExperienceForm
          experience={experience}
          projects={projects}
          onDone={() => setEditing(false)}
        />
      </div>
    );
  }
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">{children}</div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex h-8 items-center rounded-lg px-2.5 text-[13px] font-medium text-fg-2 transition-colors hover:bg-ink/[0.06] hover:text-fg"
        >
          Edit
        </button>
        {actions}
      </div>
    </div>
  );
}

/** Ghost submit button that asks before running a destructive action. */
export function ConfirmButton({ children, message }: { children: React.ReactNode; message: string }) {
  return (
    <SubmitButton
      variant="ghost"
      className="hover:!bg-red-700/[0.08] hover:!text-red-700"
      onClick={(ev) => {
        if (!window.confirm(message)) ev.preventDefault();
      }}
    >
      {children}
    </SubmitButton>
  );
}
