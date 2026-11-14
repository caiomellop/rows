import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { loadEditor } from "@/app/(app)/dashboard/load";
import { PageHeader, PageSkeleton } from "@/app/(app)/dashboard/skeleton";
import { ExperienceForm, NewExperience } from "@/components/dashboard/experience-form";
import { ResumeImport } from "@/components/dashboard/resume-import";
import { aiEnabled } from "@/lib/ai";
import { formatRange } from "@/lib/insights";

export const metadata: Metadata = { title: "Resume · Rows" };

const SOURCE_LABEL = {
  resume: "from your resume",
  linkedin: "from LinkedIn",
  assistant: "from the AI interview",
  manual: "added by hand",
} as const;

export default function ExperiencePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ExperienceBody />
    </Suspense>
  );
}

async function ExperienceBody() {
  const { experiences, projects, experienceLinks } = await loadEditor();
  const pinned = projects.filter((p) => p.pinned).map((p) => ({ id: p.id, name: p.name }));
  const ai = aiEnabled();

  return (
    <div className="space-y-8">
      <PageHeader title="Resume">
        Jobs and education. This part is self-reported, and the public page says so. Link each job to the projects you built
        there.
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-[1fr_280px]">
        <section className="surface p-5">
          <h2 className="mb-3 text-[1.4rem] text-fg">Import</h2>
          <ResumeImport aiEnabled={ai} />
        </section>
        <section className="surface flex flex-col justify-between gap-4 p-5">
          <div>
            <h2 className="text-[1.4rem] text-fg">No CV, or a weak one?</h2>
            <p className="mt-1 text-[14px] leading-relaxed text-fg-2">
              The AI assistant interviews you about each job and writes strong bullets from your answers. It never makes
              things up.
            </p>
          </div>
          <Link href="/chat" className="btn-secondary h-9 self-start rounded-lg px-4 text-[14px]">
            Start the interview
          </Link>
        </section>
      </div>

      <section aria-labelledby="entries" className="space-y-3">
        <h2 id="entries" className="text-[1.6rem] text-fg">
          Your entries
        </h2>
        {experiences.length === 0 ? <p className="text-[14px] text-fg-3">Nothing yet. Import a file or add an entry.</p> : null}
        {experiences.map((e) => (
          <details key={e.id} className="surface group p-0">
            <summary className="flex cursor-pointer list-none items-center gap-4 p-5 [&::-webkit-details-marker]:hidden">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-fg">
                  {e.title} <span className="font-normal text-fg-2">· {e.organization}</span>
                </p>
                <p className="text-[13px] text-fg-3">
                  {[e.kind === "education" ? "Education" : null, formatRange(e.startDate, e.endDate, e.current), `${e.bullets.length} bullet${e.bullets.length === 1 ? "" : "s"}`, SOURCE_LABEL[e.source]]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <span aria-hidden className="text-fg-3 transition-transform group-open:rotate-180">
                ⌄
              </span>
            </summary>
            <div className="border-t border-line p-5">
              <ExperienceForm
                key={e.id}
                experience={e}
                projects={pinned}
                linkedProjectIds={experienceLinks.filter((l) => l.experienceId === e.id).map((l) => l.projectId)}
              />
            </div>
          </details>
        ))}
        <NewExperience projects={pinned} />
      </section>
    </div>
  );
}
