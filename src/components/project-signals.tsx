import type { Project } from "@/db/schema";
import { ROLE_LABEL, commitSpan } from "@/lib/insights";

type SignalProject = Pick<
  Project,
  "role" | "userCommits" | "firstCommitAt" | "lastCommitAt" | "stars" | "hasTests" | "hasCi" | "homepage" | "languages" | "primaryLanguage"
>;

/** Facts read straight from GitHub (plan §3.2 "signals a recruiter can trust"). */
export function projectSignals(p: SignalProject): string[] {
  const out: string[] = [];
  if (p.role) out.push(ROLE_LABEL[p.role]);
  if (p.userCommits) {
    const span = commitSpan(p.firstCommitAt, p.lastCommitAt);
    out.push(`${p.userCommits} commit${p.userCommits === 1 ? "" : "s"}${span ? ` · ${span}` : ""}`);
  }
  if (p.stars > 0) out.push(`${p.stars} star${p.stars === 1 ? "" : "s"}`);
  if (p.hasTests) out.push("Has tests");
  if (p.hasCi) out.push("CI");
  return out;
}

export function topLanguages(p: Pick<Project, "languages" | "primaryLanguage">, limit = 4): string[] {
  const langs = Object.entries(p.languages)
    .sort((a, b) => b[1] - a[1])
    .map(([l]) => l);
  if (langs.length === 0 && p.primaryLanguage) return [p.primaryLanguage];
  return langs.slice(0, limit);
}

export function SignalChips({ project }: { project: SignalProject }) {
  const signals = projectSignals(project);
  const langs = topLanguages(project);
  if (signals.length === 0 && langs.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {langs.map((l) => (
        <span key={l} className="chip bg-card">
          {l}
        </span>
      ))}
      {signals.map((s) => (
        <span key={s} className="chip">
          {s}
        </span>
      ))}
    </div>
  );
}

export function VerifiedBadge({ platform = "GitHub" }: { platform?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[rgb(52_110_78)]" title={`Read directly from ${platform}, not typed by the owner`}>
      <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="currentColor">
        <path d="M8 1.2 9.9 2.6l2.3-.1.7 2.2 1.9 1.4-.8 2.2.8 2.2-1.9 1.4-.7 2.2-2.3-.1L8 14.8l-1.9-1.4-2.3.1-.7-2.2L1.2 9.9 2 7.7l-.8-2.2 1.9-1.4.7-2.2 2.3.1L8 1.2Zm2.9 4.6-3.7 3.7-1.9-1.9-.9.9 2.8 2.8 4.6-4.6-.9-.9Z" />
      </svg>
      Verified from {platform}
    </span>
  );
}
