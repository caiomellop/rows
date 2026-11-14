import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import {
  deleteExperience,
  deleteProject,
  moveProject,
  setPublished,
  toggleProjectPinned,
  toggleProjectVisible,
} from "@/app/dashboard/actions";
import {
  ConfirmButton,
  EditExperience,
  ExperienceForm,
  NewProjectForm,
  ProfileForm,
  SubmitButton,
  SyncButton,
} from "@/app/dashboard/forms";
import { ArrowUpRight, Pin, Star } from "@/components/icons";
import { SiteNav } from "@/components/site-nav";
import { formatRange } from "@/lib/dates";
import { getOwnPortfolio, type PortfolioProject } from "@/lib/portfolio";

export const metadata: Metadata = {
  title: "Dashboard · Rows",
};

const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL ?? "https://rows.so").replace(/\/$/, "");

function Section({
  id,
  title,
  description,
  aside,
  children,
}: {
  id: string;
  title: string;
  description?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="rounded-[24px] bg-panel p-1.5">
      <div className="flex flex-wrap items-end justify-between gap-3 px-4 pb-3 pt-3.5">
        <div>
          <h2 id={id} className="text-[23px] leading-tight text-fg">
            {title}
          </h2>
          {description ? <p className="mt-1 text-[14px] text-fg-2">{description}</p> : null}
        </div>
        {aside}
      </div>
      <div className="rounded-[18px] border border-line bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] sm:p-6">
        {children}
      </div>
    </section>
  );
}

function timeAgo(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

function ProjectRow({
  project,
  index,
  pinnedCount,
}: {
  project: PortfolioProject;
  index: number;
  pinnedCount: number;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[15px] font-medium text-fg">
          {project.pinned ? <Pin className="size-3.5 shrink-0 text-fg-3" /> : null}
          <span className="truncate">{project.name}</span>
          {project.url ? (
            <a
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${project.name}`}
              className="text-fg-3 hover:text-fg"
            >
              <ArrowUpRight className="size-3.5" />
            </a>
          ) : null}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[13px] text-fg-3">
          <span>{project.source === "github" ? "GitHub" : "Added by you"}</span>
          {project.language ? <span>{project.language}</span> : null}
          {project.stars > 0 ? (
            <span className="flex items-center gap-1 tabular-nums">
              <Star className="size-3" />
              {project.stars}
            </span>
          ) : null}
          {project.isFork ? <span>Fork</span> : null}
          {project.isArchived ? <span>Archived</span> : null}
        </p>
      </div>

      <div className="flex items-center gap-0.5">
        {project.pinned ? (
          <>
            <form action={moveProject.bind(null, project.id, "up")}>
              <SubmitButton variant="ghost" disabled={index === 0} aria-label={`Move ${project.name} up`}>
                ↑
              </SubmitButton>
            </form>
            <form action={moveProject.bind(null, project.id, "down")}>
              <SubmitButton
                variant="ghost"
                disabled={index === pinnedCount - 1}
                aria-label={`Move ${project.name} down`}
              >
                ↓
              </SubmitButton>
            </form>
          </>
        ) : null}
        <form action={toggleProjectPinned.bind(null, project.id)}>
          <SubmitButton variant="ghost">{project.pinned ? "Unpin" : "Pin"}</SubmitButton>
        </form>
        <form action={toggleProjectVisible.bind(null, project.id)}>
          <SubmitButton variant="ghost">{project.visible ? "Hide" : "Show"}</SubmitButton>
        </form>
        {project.source === "manual" ? (
          <form action={deleteProject.bind(null, project.id)}>
            <ConfirmButton message={`Delete “${project.name}”?`}>Delete</ConfirmButton>
          </form>
        ) : null}
      </div>
    </li>
  );
}

function ProjectGroup({
  title,
  projects,
  pinnedCount,
}: {
  title: string;
  projects: PortfolioProject[];
  pinnedCount: number;
}) {
  if (projects.length === 0) return null;
  return (
    <div>
      <h3 className="mb-3 font-sans text-[13px] font-medium text-fg-3">
        {title} <span className="tabular-nums">· {projects.length}</span>
      </h3>
      <ul className="divide-y divide-line-subtle">
        {projects.map((project, index) => (
          <ProjectRow key={project.id} project={project} index={index} pinnedCount={pinnedCount} />
        ))}
      </ul>
    </div>
  );
}

async function Dashboard() {
  const { profile, projects, experiences } = await getOwnPortfolio();
  const pinned = projects.filter((p) => p.pinned);
  const shown = projects.filter((p) => p.visible && !p.pinned);
  const hidden = projects.filter((p) => !p.visible);
  const publicPath = profile.username ? `/u/${profile.username}` : null;

  return (
    <div className="mx-auto w-full max-w-[880px] px-5 pb-24 pt-10 md:px-8 md:pt-14">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="font-geist text-[13px] font-medium text-accent">Dashboard</p>
          <h1 className="mt-2 text-[clamp(2.2rem,4.4vw,3rem)] leading-[1.02] text-fg-2">
            Your <span className="text-accent">portfolio</span>
          </h1>
          <p className="mt-3 flex flex-wrap items-center gap-2 text-[14px] text-fg-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium ${
                profile.published ? "bg-ink text-page" : "bg-ink/[0.07] text-fg-2"
              }`}
            >
              <span
                aria-hidden
                className={`size-1.5 rounded-full ${profile.published ? "bg-page" : "bg-fg-3"}`}
              />
              {profile.published ? "Live" : "Draft"}
            </span>
            {publicPath ? (
              <span className="font-geist text-fg-3">
                {APP_ORIGIN.replace(/^https?:\/\//, "")}
                {publicPath}
              </span>
            ) : null}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link href="/dashboard/preview" className="btn-secondary h-10 rounded-xl px-4 text-[14px]">
            Preview
          </Link>
          {profile.published && publicPath ? (
            <Link
              href={publicPath}
              target="_blank"
              className="btn-secondary h-10 rounded-xl px-4 text-[14px]"
            >
              View live <ArrowUpRight className="size-3.5" />
            </Link>
          ) : null}
          <form action={setPublished.bind(null, !profile.published)}>
            <SubmitButton
              variant={profile.published ? "secondary" : "primary"}
              pendingLabel={profile.published ? "Unpublishing…" : "Publishing…"}
            >
              {profile.published ? "Unpublish" : "Publish profile"}
            </SubmitButton>
          </form>
        </div>
      </header>

      <div className="mt-10 grid gap-6">
        <Section id="profile" title="Profile" description="Who you are, in a sentence and a few paragraphs.">
          <ProfileForm profile={profile} origin={APP_ORIGIN} />
        </Section>

        <Section
          id="projects"
          title="Projects"
          description={
            profile.lastSyncedAt
              ? `Public GitHub repos, synced ${timeAgo(profile.lastSyncedAt)}. Pin your best work to the top.`
              : "Pull in your public GitHub repos, then pin your best work to the top."
          }
          aside={<SyncButton />}
        >
          <div className="grid gap-7">
            {projects.length === 0 ? (
              <p className="text-[14px] text-fg-3">
                No projects yet. Sync GitHub or add one by hand below.
              </p>
            ) : (
              <>
                <ProjectGroup title="Pinned" projects={pinned} pinnedCount={pinned.length} />
                <ProjectGroup title="Shown" projects={shown} pinnedCount={pinned.length} />
                <ProjectGroup title="Hidden" projects={hidden} pinnedCount={pinned.length} />
              </>
            )}

            <details className="group rounded-[18px] border border-dashed border-ink/15 open:border-solid open:border-line">
              <summary className="cursor-pointer list-none px-5 py-3.5 text-[14px] font-medium text-fg-2 hover:text-fg [&::-webkit-details-marker]:hidden">
                <span className="mr-1.5 inline-block transition-transform group-open:rotate-45">+</span>
                Add a project that isn&apos;t on GitHub
              </summary>
              <div className="px-5 pb-5">
                <NewProjectForm />
              </div>
            </details>
          </div>
        </Section>

        <Section id="experience" title="Experience" description="Roles, newest first. Link the projects you built there.">
          <div className="grid gap-7">
            {experiences.length > 0 ? (
              <ol className="divide-y divide-line-subtle">
                {experiences.map((exp) => (
                  <li key={exp.id} className="py-4 first:pt-0">
                    <EditExperience
                      experience={exp}
                      projects={projects}
                      actions={
                        <form action={deleteExperience.bind(null, exp.id)}>
                          <ConfirmButton message={`Delete ${exp.role} at ${exp.company}?`}>
                            Delete
                          </ConfirmButton>
                        </form>
                      }
                    >
                      <p className="text-[15px] font-medium text-fg">
                        {exp.role} <span className="font-normal text-fg-3">at</span> {exp.company}
                      </p>
                      <p className="mt-0.5 text-[13px] text-fg-3">
                        {formatRange(exp.startDate, exp.endDate)}
                        {exp.location ? ` · ${exp.location}` : ""}
                        {exp.projectIds.length > 0
                          ? ` · ${exp.projectIds.length} ${exp.projectIds.length === 1 ? "project" : "projects"}`
                          : ""}
                      </p>
                    </EditExperience>
                  </li>
                ))}
              </ol>
            ) : null}

            <details
              className="group rounded-[18px] border border-dashed border-ink/15 open:border-solid open:border-line"
              open={experiences.length === 0}
            >
              <summary className="cursor-pointer list-none px-5 py-3.5 text-[14px] font-medium text-fg-2 hover:text-fg [&::-webkit-details-marker]:hidden">
                <span className="mr-1.5 inline-block transition-transform group-open:rotate-45">+</span>
                Add experience
              </summary>
              <div className="px-5 pb-5">
                <ExperienceForm projects={projects} />
              </div>
            </details>
          </div>
        </Section>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-[880px] px-5 pt-10 md:px-8 md:pt-14">
      <div className="h-4 w-20 animate-pulse rounded bg-ink/[0.07]" />
      <div className="mt-3 h-12 w-72 animate-pulse rounded-lg bg-ink/[0.07]" />
      <div className="mt-10 grid gap-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-64 animate-pulse rounded-[24px] bg-panel" />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <>
      <SiteNav />
      <main className="flex flex-1 flex-col">
        <Suspense fallback={<DashboardSkeleton />}>
          <Dashboard />
        </Suspense>
      </main>
    </>
  );
}
