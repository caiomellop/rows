import type { ProjectRole } from "@/db/schema";

/** Client-safe helpers that turn platform data into recruiter language. */

type StackInput = {
  primaryLanguage: string | null;
  languages: Record<string, number>;
  pushedAt: Date | null;
  isFork: boolean;
};

export type StackEvidence = { language: string; repos: number; lastActive: Date | null };

/**
 * "TypeScript: 14 repos, last commit 3 days ago" (plan §3.1). A repo counts for
 * a language when it's the primary one or makes up at least 15% of the code.
 */
export function stackEvidence(projects: StackInput[], limit = 6): StackEvidence[] {
  const byLang = new Map<string, StackEvidence>();
  for (const p of projects) {
    if (p.isFork) continue;
    const total = Object.values(p.languages).reduce((a, b) => a + b, 0);
    const langs = new Set<string>();
    if (p.primaryLanguage) langs.add(p.primaryLanguage);
    for (const [lang, bytes] of Object.entries(p.languages)) {
      if (total > 0 && bytes / total >= 0.15) langs.add(lang);
    }
    for (const lang of langs) {
      const entry = byLang.get(lang) ?? { language: lang, repos: 0, lastActive: null };
      entry.repos += 1;
      if (p.pushedAt && (!entry.lastActive || p.pushedAt > entry.lastActive)) entry.lastActive = p.pushedAt;
      byLang.set(lang, entry);
    }
  }
  return [...byLang.values()]
    .sort((a, b) => b.repos - a.repos || (b.lastActive?.getTime() ?? 0) - (a.lastActive?.getTime() ?? 0))
    .slice(0, limit);
}

export const ROLE_LABEL: Record<ProjectRole, string> = {
  sole_author: "Sole author",
  main_contributor: "Main contributor",
  contributor: "Contributor",
};

export function relativeTime(date: Date | null, now = new Date()): string {
  if (!date) return "unknown";
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? "1 month ago" : `${months} months ago`;
  const years = Math.floor(months / 12);
  return years === 1 ? "1 year ago" : `${years} years ago`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2023-04" → "Apr 2023", "2021" → "2021". */
export function formatYearMonth(value: string | null): string {
  if (!value) return "";
  const [y, m] = value.split("-");
  const month = m ? MONTHS[Number(m) - 1] : undefined;
  return month ? `${month} ${y}` : y;
}

export function formatRange(start: string | null, end: string | null, current: boolean): string {
  const from = formatYearMonth(start);
  const to = current ? "Present" : formatYearMonth(end);
  if (from && to) return `${from} – ${to}`;
  return from || to;
}

export function formatMonthYear(date: Date | null): string {
  if (!date) return "";
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** "Apr 2022 – Jan 2024" for a project's commit span. */
export function commitSpan(first: Date | null, last: Date | null): string {
  if (!first || !last) return "";
  const a = formatMonthYear(first);
  const b = formatMonthYear(last);
  return a === b ? a : `${a} – ${b}`;
}

export const WORK_MODE_LABEL = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "On-site",
  flexible: "Remote or on-site",
} as const;

export const ROLE_TYPES = ["Full-time", "Part-time", "Contract", "Freelance", "Internship"] as const;

export const MAX_PINNED = 6;
