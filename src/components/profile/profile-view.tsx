import Link from "next/link";

import { revealContact } from "@/app/in/[handle]/actions";
import { ContactButton } from "@/components/profile/contact-button";
import { ViewToggle } from "@/components/profile/view-toggle";
import { SignalChips, VerifiedBadge } from "@/components/project-signals";
import type { PublicProfile } from "@/lib/dal";
import { profilePath } from "@/lib/profile-url";
import { WORK_MODE_LABEL, formatMonthYear, formatRange } from "@/lib/insights";
import { appHref } from "@/lib/app-url";

const anchor = (name: string) => `project-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

/** The public, recruiter-first profile (product plan §3). */
export function ProfileView({ data, preview = false }: { data: PublicProfile; preview?: boolean }) {
  const { profile, projects, experiences, experienceLinks, stack, image } = data;
  const name = profile.displayName ?? profile.username;
  const work = experiences.filter((e) => e.kind === "work");
  const education = experiences.filter((e) => e.kind === "education");
  const projectName = new Map(projects.map((p) => [p.id, p.name]));

  const status = [
    profile.location,
    profile.timezone,
    profile.workMode ? WORK_MODE_LABEL[profile.workMode] : null,
    profile.roleTypes.length ? profile.roleTypes.join(" / ") : null,
    profile.workAuthorization,
  ].filter(Boolean) as string[];

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 pb-20 pt-8 md:px-6 md:pt-12">
      {preview ? (
        <p className="mb-6 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-[14px] text-amber-900">
          Preview: only you can see this page.{" "}
          <Link href={appHref("/dashboard")} className="underline underline-offset-2">
            Publish it from your dashboard
          </Link>
          .
        </p>
      ) : null}

      {/* 3.1 The 60-second header */}
      <header className="surface p-6 md:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" width={88} height={88} className="size-[88px] shrink-0 rounded-2xl border border-line object-cover" />
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="text-[2.4rem] leading-[1.05] text-fg">{name}</h1>
              {profile.openToWork ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgb(52_110_78/0.1)] px-2.5 py-1 text-[13px] font-medium text-[rgb(40_92_64)]">
                  <span aria-hidden className="size-1.5 rounded-full bg-[rgb(52_140_90)]" />
                  Open to work
                </span>
              ) : null}
            </div>
            {profile.headline ? <p className="mt-2 font-geist text-[17px] text-fg-2">{profile.headline}</p> : null}
            {status.length ? <p className="mt-2 text-[14px] text-fg-3">{status.join(" · ")}</p> : null}
          </div>
        </div>

        {profile.summary ? <p className="mt-6 max-w-[680px] text-[17px] leading-[1.65] text-fg">{profile.summary}</p> : null}

        {stack.length ? (
          <div className="mt-6">
            <div className="flex flex-wrap items-center gap-2">
              {stack.map((s) => (
                <span key={s.language} className="chip bg-card text-[13px]">
                  <span className="font-medium text-fg">{s.language}</span>
                  <span className="text-fg-3">
                    {s.repos} repo{s.repos === 1 ? "" : "s"}
                    {s.lastActive ? ` · active ${formatMonthYear(s.lastActive)}` : ""}
                  </span>
                </span>
              ))}
            </div>
            <div className="mt-2">
              <VerifiedBadge />
            </div>
          </div>
        ) : null}

        <div className="mt-7 flex flex-wrap items-center gap-2.5">
          <a href={`${profilePath(profile.username)}/resume`} className={`${profile.hasContact ? "btn-secondary" : "btn-primary"} h-10 rounded-xl px-5 text-[15px]`}>
            Download resume (PDF)
          </a>
          {profile.hasContact ? <ContactButton reveal={revealContact.bind(null, profile.username)} /> : null}
          <span className="flex flex-wrap gap-3 pl-1 text-[14px] text-fg-2">
            {profile.githubLogin ? (
              <a href={`https://github.com/${profile.githubLogin}`} target="_blank" rel="noreferrer me" className="hover:text-fg hover:underline">
                GitHub
              </a>
            ) : null}
            {profile.links.linkedin ? (
              <a href={profile.links.linkedin} target="_blank" rel="noreferrer me" className="hover:text-fg hover:underline">
                LinkedIn
              </a>
            ) : null}
            {profile.links.website ? (
              <a href={profile.links.website} target="_blank" rel="noreferrer me" className="hover:text-fg hover:underline">
                Website
              </a>
            ) : null}
          </span>
        </div>
      </header>

      <div className="mt-10">
        <ViewToggle>
          {/* 3.2 Projects, translated */}
          {projects.length ? (
            <section aria-labelledby="projects-heading" className="space-y-4">
              <h2 id="projects-heading" className="text-[1.9rem] text-fg">
                Projects
              </h2>
              {projects.map((p) => {
                const card = p.cardStatus === "approved" ? p.card : null;
                const deps = p.dependencies.slice(0, 24);
                const totalBytes = Object.values(p.languages).reduce((a, b) => a + b, 0);
                return (
                  <article key={p.id} id={anchor(p.name)} className="surface scroll-mt-6 p-5 md:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h3 className="font-sans text-[18px] font-semibold text-fg">{p.name}</h3>
                      <div className="flex gap-3 text-[14px]">
                        {p.homepage ? (
                          <a href={p.homepage} target="_blank" rel="noreferrer" className="font-medium text-fg underline-offset-2 hover:underline">
                            Live demo ↗
                          </a>
                        ) : null}
                        <a href={p.url} target="_blank" rel="noreferrer" className="text-fg-2 underline-offset-2 hover:text-fg hover:underline">
                          See the code ↗
                        </a>
                      </div>
                    </div>
                    <p className="mt-2 text-[16px] leading-relaxed text-fg">{card?.whatItIs ?? p.description ?? "No description yet."}</p>
                    {card?.highlights.length ? (
                      <ul className="mt-3 space-y-1.5 text-[15px] leading-relaxed text-fg-2">
                        {card.highlights.map((h) => (
                          <li key={h.text} className="flex gap-2">
                            <span aria-hidden className="mt-[0.6em] size-1 shrink-0 rounded-full bg-fg-3" />
                            {h.text}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
                      <SignalChips project={p} />
                      <VerifiedBadge />
                    </div>

                    <div className="mt-4 hidden space-y-3 border-t border-line pt-4 text-[14px] text-fg-2 group-data-[view=developer]/view:block">
                      {totalBytes > 0 ? (
                        <p>
                          <span className="font-medium text-fg">Languages: </span>
                          {Object.entries(p.languages)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 6)
                            .map(([l, b]) => `${l} ${Math.round((b / totalBytes) * 100)}%`)
                            .join(" · ")}
                        </p>
                      ) : null}
                      {deps.length ? (
                        <p>
                          <span className="font-medium text-fg">Dependencies: </span>
                          {deps.join(", ")}
                          {p.dependencies.length > deps.length ? ` and ${p.dependencies.length - deps.length} more` : ""}
                        </p>
                      ) : null}
                      <p>
                        <span className="font-medium text-fg">Repo: </span>
                        {p.fullName}
                        {p.forks ? ` · ${p.forks} forks` : ""}
                        {p.createdAtSource ? ` · created ${formatMonthYear(p.createdAtSource)}` : ""}
                        {p.topics.length ? ` · ${p.topics.join(", ")}` : ""}
                      </p>
                    </div>
                    {card ? <p className="mt-3 text-[12px] text-fg-3">Summary written with AI from the repo and approved by {name.split(" ")[0]}.</p> : null}
                  </article>
                );
              })}
            </section>
          ) : null}

          {/* 3.3 Experience timeline */}
          {work.length ? (
            <TimelineSection title="Experience" entries={work} experienceLinks={experienceLinks} projectName={projectName} />
          ) : null}
          {education.length ? (
            <TimelineSection title="Education" entries={education} experienceLinks={experienceLinks} projectName={projectName} />
          ) : null}
        </ViewToggle>
      </div>

      <footer className="mt-16 flex justify-center">
        <Link href="/" className="chip bg-card text-[13px] hover:text-fg">
          Made with <span className="font-geist font-semibold tracking-[-0.03em] text-fg">Rows</span>
        </Link>
      </footer>
    </div>
  );
}

function TimelineSection({
  title,
  entries,
  experienceLinks,
  projectName,
}: {
  title: string;
  entries: PublicProfile["experiences"];
  experienceLinks: PublicProfile["experienceLinks"];
  projectName: Map<string, string>;
}) {
  return (
    <section aria-label={title} className="mt-12">
      <h2 className="mb-4 text-[1.9rem] text-fg">{title}</h2>
      <ol className="surface divide-y divide-line">
        {entries.map((e) => {
          const linked = experienceLinks.filter((l) => l.experienceId === e.id).map((l) => projectName.get(l.projectId)).filter(Boolean) as string[];
          return (
            <li key={e.id} className="p-5 md:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="font-sans text-[16px] font-semibold text-fg">
                  {e.title} <span className="font-normal text-fg-2">· {e.organization}</span>
                </h3>
                <span className="text-[14px] tabular-nums text-fg-3">{formatRange(e.startDate, e.endDate, e.current)}</span>
              </div>
              <p className="text-[13px] text-fg-3">
                {e.location ? `${e.location} · ` : ""}
                <span title="Written by the owner, not verified by Rows">Self-reported</span>
              </p>
              {e.bullets.length ? (
                <ul className="mt-3 space-y-1.5 text-[15px] leading-relaxed text-fg-2">
                  {e.bullets.map((b) => (
                    <li key={b} className="flex gap-2">
                      <span aria-hidden className="mt-[0.6em] size-1 shrink-0 rounded-full bg-fg-3" />
                      {b}
                    </li>
                  ))}
                </ul>
              ) : null}
              {e.skills.length || linked.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {linked.map((n) => (
                    <a key={n} href={`#${anchor(n)}`} className="chip bg-card hover:text-fg">
                      Project: {n}
                    </a>
                  ))}
                  {e.skills.map((s) => (
                    <span key={s} className="chip">
                      {s}
                    </span>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
