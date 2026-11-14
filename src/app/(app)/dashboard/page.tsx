import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { setPublished } from "@/app/(app)/dashboard/actions";
import { loadEditor, publicUrl } from "@/app/(app)/dashboard/load";
import { PageHeader, PageSkeleton } from "@/app/(app)/dashboard/skeleton";
import { ActionButton } from "@/components/dashboard/action-button";
import { CopyButton } from "@/components/dashboard/copy-button";
import { Check } from "@/components/icons";
import { profilePath } from "@/lib/profile-url";
import { siteHref } from "@/lib/app-url";

export const metadata: Metadata = { title: "Dashboard · Rows" };

export default function DashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Overview />
    </Suspense>
  );
}

async function Overview() {
  const { profile, projects, experiences } = await loadEditor();
  const pinned = projects.filter((p) => p.pinned);
  const approved = pinned.filter((p) => p.cardStatus === "approved");
  const url = publicUrl(profile.username);

  const steps = [
    {
      done: Boolean(profile.reposSyncedAt),
      title: "Sync your GitHub repos",
      body: "Rows reads your public repos: languages, commits, tests, README.",
      href: "/dashboard/projects",
      cta: "Go to projects",
    },
    {
      done: pinned.length > 0 && approved.length === pinned.length,
      title: "Pin your best projects and approve their cards",
      body: `AI translates each repo into plain English for recruiters. ${approved.length} of ${pinned.length} pinned ${pinned.length === 1 ? "card is" : "cards are"} approved.`,
      href: "/dashboard/projects",
      cta: "Review cards",
    },
    {
      done: experiences.length > 0,
      title: "Add your experience",
      body: "Upload your resume or LinkedIn PDF, or build it from scratch with the AI assistant.",
      href: "/dashboard/experience",
      cta: "Add experience",
    },
    {
      done: Boolean(profile.headline && profile.summary),
      title: "Write your headline and summary",
      body: "The 60-second header a recruiter reads first. AI can draft it from your projects and experience.",
      href: "/dashboard/profile",
      cta: "Edit profile",
    },
  ];
  const ready = steps.every((s) => s.done);

  return (
    <div className="space-y-6">
      <PageHeader title={profile.published ? "Your profile is live" : "Build your profile"}>
        {profile.published
          ? "Share the link below. It updates whenever you change something here."
          : "Four steps, about five minutes. Then publish one link a recruiter can read in 60 seconds."}
      </PageHeader>

      <section className="surface p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[13px] font-medium uppercase tracking-wide text-fg-3">Your link</p>
            <p className="mt-1 truncate font-geist text-[17px] text-fg">{url.replace(/^https?:\/\//, "")}</p>
            <p className="mt-1 text-[13px] text-fg-3">
              {profile.published ? "Public: anyone with the link can see it." : "Hidden: only you can open it while you're building."}
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <CopyButton value={url} />
            <Link href={siteHref(profilePath(profile.username))} className="btn-secondary h-9 rounded-lg px-3.5 text-[14px]" prefetch={false}>
              Preview
            </Link>
            {profile.published ? (
              <ActionButton action={setPublished.bind(null, false)} pendingLabel="Hiding…" confirm="Hide your public profile?">
                Unpublish
              </ActionButton>
            ) : (
              <ActionButton
                action={setPublished.bind(null, true)}
                pendingLabel="Publishing…"
                className="btn-primary h-9 rounded-lg px-4 text-[14px]"
              >
                {ready ? "Publish" : "Publish anyway"}
              </ActionButton>
            )}
          </div>
        </div>
      </section>

      <ol className="surface divide-y divide-line">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-4 p-5 md:p-6">
            <span
              aria-hidden
              className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-medium ${
                step.done ? "bg-ink text-page" : "border border-ink/20 text-fg-2"
              }`}
            >
              {step.done ? <Check className="size-3.5" /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-sans text-[16px] font-medium text-fg">
                {step.title}
                <span className="sr-only">{step.done ? " (done)" : " (to do)"}</span>
              </h2>
              <p className="mt-1 text-[14px] leading-relaxed text-fg-2">{step.body}</p>
            </div>
            <Link href={step.href} className="btn-secondary h-9 shrink-0 self-center rounded-lg px-3.5 text-[14px]">
              {step.done ? "Edit" : step.cta}
            </Link>
          </li>
        ))}
      </ol>

      {profile.published ? (
        <section className="surface grid gap-6 p-5 md:grid-cols-[1fr_320px] md:p-6">
          <div>
            <h2 className="text-[1.5rem] text-fg">Put it on LinkedIn</h2>
            <p className="mt-1 text-[14px] leading-relaxed text-fg-2">
              The Featured section shows your link as a large card. Recruiters see it before they scroll.
            </p>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-[14px] leading-relaxed text-fg-2">
              <li>Open your LinkedIn profile and choose <span className="text-fg">Add section → Recommended → Add featured</span>.</li>
              <li>Pick <span className="text-fg">Add a link</span> and paste your Rows link.</li>
              <li>Also add it under <span className="text-fg">Contact info → Website</span>.</li>
            </ol>
            <div className="mt-5 flex flex-wrap gap-2">
              <CopyButton value={url} label="Copy your link" />
              <a href={siteHref(`${profilePath(profile.username)}/resume`)} className="btn-secondary h-9 rounded-lg px-3.5 text-[14px]">
                Download resume PDF
              </a>
            </div>
          </div>
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={siteHref(`${profilePath(profile.username)}/opengraph-image`)}
              alt="The card LinkedIn shows for your link"
              width={1200}
              height={630}
              className="w-full rounded-xl border border-line"
            />
            <figcaption className="mt-2 text-[12px] text-fg-3">What LinkedIn shows for your link.</figcaption>
          </figure>
        </section>
      ) : null}
    </div>
  );
}
