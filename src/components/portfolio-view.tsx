import Image from "next/image";
import Link from "next/link";

import {
  ArrowUpRight,
  GitHubMark,
  LinkIcon,
  MapPin,
  Pin,
  Star,
} from "@/components/icons";
import { formatRange } from "@/lib/dates";
import type { Portfolio, PortfolioProject } from "@/lib/portfolio";

function displayHost(url: string) {
  try {
    const { hostname, pathname } = new URL(url);
    const path = pathname === "/" ? "" : pathname.replace(/\/$/, "");
    return `${hostname.replace(/^www\./, "")}${path}`;
  } catch {
    return url;
  }
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function ProjectCard({ project }: { project: PortfolioProject }) {
  const href = project.homepage ?? project.url;
  return (
    <article
      id={`project-${project.id}`}
      className="group relative flex scroll-mt-24 flex-col rounded-[18px] border border-line bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-colors hover:border-ink/15"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[21px] leading-tight text-fg">
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="after:absolute after:inset-0 after:rounded-[18px] focus-visible:outline-none"
            >
              {project.name}
            </a>
          ) : (
            project.name
          )}
        </h3>
        <span className="mt-1 flex shrink-0 items-center gap-1.5 text-fg-3">
          {project.pinned ? <Pin className="size-3.5" /> : null}
          {href ? (
            <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-fg" />
          ) : null}
        </span>
      </div>

      {project.description ? (
        <p className="mt-2 text-sm leading-normal text-fg-2">{project.description}</p>
      ) : null}

      {project.topics.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Topics">
          {project.topics.slice(0, 4).map((topic) => (
            <li
              key={topic}
              className="rounded-full bg-ink/[0.05] px-2 py-0.5 text-[12px] text-fg-2"
            >
              {topic}
            </li>
          ))}
        </ul>
      ) : null}

      {project.language || project.stars > 0 ? (
        <div className="mt-auto flex items-center gap-4 pt-4 text-[13px] text-fg-3">
          {project.language ? (
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full bg-ink/60" />
              {project.language}
            </span>
          ) : null}
          {project.stars > 0 ? (
            <span className="flex items-center gap-1 tabular-nums">
              <Star className="size-3.5" />
              <span className="sr-only">Stars:</span>
              {project.stars.toLocaleString("en-US")}
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

const sectionTitle = "mb-4 text-[23px] leading-tight text-fg";

/**
 * A portfolio as visitors see it. Used by the public page and by the owner's
 * preview, so both always match. Pass data already filtered for visitors.
 */
export function PortfolioView({ portfolio }: { portfolio: Portfolio }) {
  const { profile, projects, experiences } = portfolio;
  const name = profile.name ?? profile.username ?? "Unnamed";
  const projectsById = new Map(projects.map((p) => [p.id, p]));
  const aboutParagraphs = (profile.about ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const isEmpty = !aboutParagraphs.length && !projects.length && !experiences.length;

  return (
    <div className="relative flex flex-1 flex-col">
      <div
        aria-hidden
        className="dot-grid dot-grid-center pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px]"
      />
      <main className="mx-auto w-full max-w-[760px] flex-1 px-5 pb-20 pt-[clamp(48px,9vh,96px)] md:px-8">
        <header className="anim-rise">
          {profile.image ? (
            <Image
              src={profile.image}
              alt=""
              width={76}
              height={76}
              className="size-[76px] rounded-full border border-line bg-panel"
              priority
            />
          ) : (
            <span className="grid size-[76px] place-items-center rounded-full border border-line bg-panel font-geist text-xl text-fg-2">
              {initials(name)}
            </span>
          )}

          <h1 className="mt-6 text-balance text-[clamp(2.3rem,5vw,3.2rem)] leading-[1.05] text-fg">
            {name}
          </h1>
          {profile.headline ? (
            <p className="mt-3 max-w-[600px] text-balance font-geist text-[clamp(1.02rem,1.6vw,1.2rem)] leading-snug text-fg-2">
              {profile.headline}
            </p>
          ) : null}

          <ul className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px] text-fg-2">
            {profile.location ? (
              <li className="flex items-center gap-1.5">
                <MapPin className="size-4 text-fg-3" />
                {profile.location}
              </li>
            ) : null}
            {profile.website ? (
              <li>
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer me"
                  className="flex items-center gap-1.5 underline-offset-4 hover:text-fg hover:underline"
                >
                  <LinkIcon className="size-4 text-fg-3" />
                  {displayHost(profile.website)}
                </a>
              </li>
            ) : null}
            {profile.githubLogin ? (
              <li>
                <a
                  href={`https://github.com/${profile.githubLogin}`}
                  target="_blank"
                  rel="noopener noreferrer me"
                  className="flex items-center gap-1.5 underline-offset-4 hover:text-fg hover:underline"
                >
                  <GitHubMark className="size-4 text-fg-3" />
                  {profile.githubLogin}
                </a>
              </li>
            ) : null}
          </ul>
        </header>

        <div className="anim-rise-delay">
          {aboutParagraphs.length > 0 ? (
            <section aria-labelledby="about" className="mt-14">
              <h2 id="about" className={sectionTitle}>
                About
              </h2>
              <div className="max-w-[640px] space-y-4 text-[15px] leading-relaxed text-fg-2">
                {aboutParagraphs.map((p, i) => (
                  <p key={i} className="whitespace-pre-line">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ) : null}

          {projects.length > 0 ? (
            <section aria-labelledby="projects" className="mt-14">
              <h2 id="projects" className={sectionTitle}>
                Projects
              </h2>
              <div className="grid gap-3.5 sm:grid-cols-2">
                {projects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            </section>
          ) : null}

          {experiences.length > 0 ? (
            <section aria-labelledby="experience" className="mt-14">
              <h2 id="experience" className={sectionTitle}>
                Experience
              </h2>
              <ol className="border-t border-line-subtle">
                {experiences.map((exp) => {
                  const linked = exp.projectIds
                    .map((id) => projectsById.get(id))
                    .filter((p): p is PortfolioProject => Boolean(p));
                  return (
                    <li
                      key={exp.id}
                      className="grid gap-1 border-b border-line-subtle py-6 sm:grid-cols-[170px_1fr] sm:gap-6"
                    >
                      <p className="pt-1 font-geist text-[13px] text-fg-3 tabular-nums">
                        {formatRange(exp.startDate, exp.endDate)}
                      </p>
                      <div>
                        <h3 className="text-[21px] leading-tight text-fg">
                          {exp.role}{" "}
                          <span className="text-fg-3">
                            at <span className="italic text-fg-2">{exp.company}</span>
                          </span>
                        </h3>
                        {exp.location ? (
                          <p className="mt-1 text-[13px] text-fg-3">{exp.location}</p>
                        ) : null}
                        {exp.description ? (
                          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-fg-2">
                            {exp.description}
                          </p>
                        ) : null}
                        {linked.length > 0 ? (
                          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Projects">
                            {linked.map((p) => (
                              <li key={p.id}>
                                <a
                                  href={`#project-${p.id}`}
                                  className="inline-flex rounded-full border border-line px-2.5 py-0.5 text-[12px] text-fg-2 transition-colors hover:border-ink/20 hover:text-fg"
                                >
                                  {p.name}
                                </a>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : null}

          {isEmpty ? (
            <p className="mt-14 rounded-[18px] border border-dashed border-ink/15 px-5 py-8 text-center text-sm text-fg-3">
              Nothing here yet.
            </p>
          ) : null}
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[760px] items-center justify-between px-5 py-5 text-[13px] text-fg-3 md:px-8">
          <span>
            {profile.username ? `rows.so/u/${profile.username}` : null}
          </span>
          <Link href="/" className="flex items-center gap-2 hover:text-fg">
            Made with
            <span className="font-geist text-[15px] font-semibold tracking-[-0.04em] text-fg">
              Rows
            </span>
          </Link>
        </div>
      </footer>
    </div>
  );
}
