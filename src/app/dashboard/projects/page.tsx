import type { Metadata } from "next";
import { Suspense } from "react";

import { draftCard, movePinned, refreshDetails, saveCard, setPinned, syncRepos } from "@/app/dashboard/actions";
import { loadEditor } from "@/app/dashboard/load";
import { PageHeader, PageSkeleton } from "@/app/dashboard/skeleton";
import { ActionButton } from "@/components/dashboard/action-button";
import { CardEditor } from "@/components/dashboard/card-editor";
import { RepoBrowser } from "@/components/dashboard/repo-browser";
import { SignalChips, VerifiedBadge } from "@/components/project-signals";
import { aiEnabled } from "@/lib/ai";
import { MAX_PINNED, relativeTime } from "@/lib/insights";

export const metadata: Metadata = { title: "Projects · Rows" };

export default function ProjectsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Projects />
    </Suspense>
  );
}

async function Projects() {
  const { profile, projects } = await loadEditor();
  const pinned = projects.filter((p) => p.pinned);
  const ai = aiEnabled();

  return (
    <div className="space-y-8">
      <PageHeader title="Projects">
        Pin up to {MAX_PINNED} repos. Each one becomes a card a recruiter can read: what it is in plain English, your role, and
        facts read straight from GitHub.
      </PageHeader>

      <section className="surface flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-[15px] font-medium text-fg">GitHub{profile.githubLogin ? ` · @${profile.githubLogin}` : ""}</p>
          <p className="text-[13px] text-fg-3">
            {profile.reposSyncedAt
              ? `${projects.length} public repos · synced ${relativeTime(profile.reposSyncedAt)}`
              : "Not synced yet. Rows reads public repos only."}
          </p>
        </div>
        <ActionButton
          action={syncRepos}
          pendingLabel="Syncing…"
          className={`${profile.reposSyncedAt ? "btn-secondary" : "btn-primary"} h-9 rounded-lg px-4 text-[14px]`}
        >
          {profile.reposSyncedAt ? "Sync again" : "Sync repos from GitHub"}
        </ActionButton>
      </section>

      {!ai ? (
        <p className="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-[14px] text-amber-900">
          AI drafting is off because <code>ANTHROPIC_API_KEY</code> isn&apos;t set. You can still write cards by hand.
        </p>
      ) : null}

      <section aria-labelledby="pinned-heading" className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 id="pinned-heading" className="text-[1.6rem] text-fg">
            Pinned
          </h2>
          <span className="text-[13px] text-fg-3">
            {pinned.length} of {MAX_PINNED}
          </span>
        </div>

        {pinned.length === 0 ? (
          <p className="surface p-5 text-[14px] text-fg-2">
            {projects.length ? "Pin your best repos from the list below. Pick ones with a README: the card is only as good as what's written there." : "Sync your repos first."}
          </p>
        ) : null}

        {pinned.map((p, i) => (
          <article key={p.id} className="surface space-y-4 p-5">
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-sans text-[17px] font-semibold text-fg">
                  <a href={p.url} target="_blank" rel="noreferrer" className="hover:underline">
                    {p.name}
                  </a>
                </h3>
                {p.description ? <p className="mt-0.5 text-[14px] text-fg-2">{p.description}</p> : null}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <ActionButton action={movePinned.bind(null, p.id, -1)} className="btn-secondary size-8 rounded-lg text-[14px]" showMessage={false}>
                  <span aria-hidden>↑</span>
                  <span className="sr-only">Move {p.name} up</span>
                </ActionButton>
                <ActionButton action={movePinned.bind(null, p.id, 1)} className="btn-secondary size-8 rounded-lg text-[14px]" showMessage={false}>
                  <span aria-hidden>↓</span>
                  <span className="sr-only">Move {p.name} down</span>
                </ActionButton>
                <ActionButton action={setPinned.bind(null, p.id, false)} className="btn-secondary h-8 rounded-lg px-3 text-[13px]">
                  Unpin
                </ActionButton>
              </div>
            </header>

            <div className="space-y-2">
              <SignalChips project={p} />
              <div className="flex flex-wrap items-center gap-3">
                {p.detailsSyncedAt ? <VerifiedBadge /> : <span className="text-[12px] text-fg-3">Signals not loaded yet</span>}
                <ActionButton action={refreshDetails.bind(null, p.id)} className="text-[12px] text-fg-3 underline-offset-2 hover:text-fg hover:underline" pendingLabel="Refreshing…">
                  Refresh from GitHub
                </ActionButton>
                {i === 0 ? <span className="text-[12px] text-fg-3">· First pinned project shows first</span> : null}
              </div>
            </div>

            <CardEditor
              key={JSON.stringify(p.card)}
              card={p.card}
              status={p.cardStatus}
              aiEnabled={ai}
              draft={draftCard.bind(null, p.id)}
              save={saveCard.bind(null, p.id)}
            />
          </article>
        ))}
      </section>

      {projects.length > 0 ? (
        <section aria-labelledby="all-heading" className="space-y-4">
          <h2 id="all-heading" className="text-[1.6rem] text-fg">
            All public repos
          </h2>
          <RepoBrowser
            setPinned={setPinned}
            canPinMore={pinned.length < MAX_PINNED}
            repos={projects.map((p) => ({
              id: p.id,
              name: p.name,
              description: p.description,
              primaryLanguage: p.primaryLanguage,
              stars: p.stars,
              pushedAt: p.pushedAt,
              isFork: p.isFork,
              isArchived: p.isArchived,
              pinned: p.pinned,
            }))}
          />
        </section>
      ) : null}
    </div>
  );
}
