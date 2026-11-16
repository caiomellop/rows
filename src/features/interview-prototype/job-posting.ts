import type { Job } from "./schemas";

/**
 * Pure helpers around a job posting read from a link: cleaning the scraped page for the model and turning
 * what the model kept into the text the interviewer works from.
 */

/** One web page as Apify returned it. */
export type Page = {
  requestedUrl: string;
  /** Where the page really loaded from. It differs from the link when the site redirected, for example to a list of jobs. */
  finalUrl: string;
  title: string;
  /** The HTTP status of the page, or null when Apify did not say. */
  status: number | null;
  text: string;
};

/** A page with less text than this has no posting in it: usually a script-only page that showed nothing without a browser. */
export const THIN_PAGE_CHARS = 500;
/** What reaches the model. A long posting fits; a huge page cannot run up the bill. */
export const MAX_PAGE_CHARS = 30_000;

/** Makes the page's Markdown cheaper and clearer to read: images go, links keep only their text, blank runs shrink. */
export function cleanPageText(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isThinPage(text: string): boolean {
  return cleanPageText(text).length < THIN_PAGE_CHARS;
}

/** The page as the extractor sees it. Angle brackets are removed so the page cannot close our tags. */
export function pageForModel(page: Page): string {
  const plain = (value: string) => value.replace(/[<>]/g, "");
  return [
    "<page>",
    `<requested_link>${plain(page.requestedUrl)}</requested_link>`,
    `<final_address>${plain(page.finalUrl)}</final_address>`,
    `<http_status>${page.status ?? "unknown"}</http_status>`,
    `<title>${plain(page.title)}</title>`,
    "<text>",
    plain(cleanPageText(page.text)).slice(0, MAX_PAGE_CHARS),
    "</text>",
    "</page>",
  ].join("\n");
}

const MAX_ITEMS = 20;
const MAX_ITEM_CHARS = 300;

const tidy = (value: string) => value.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, MAX_ITEM_CHARS);

/** The text the interviewer gets as the job description: only what the model kept, in a fixed order. */
export function jobToText(job: Job): string {
  const section = (title: string, items: string[]) => {
    const rows = items.map(tidy).filter(Boolean).slice(0, MAX_ITEMS);
    return rows.length > 0 ? ["", `${title}:`, ...rows.map((row) => `- ${row}`)] : [];
  };

  const lines = [`Role: ${tidy(job.roleTitle)}`];
  if (job.companyName && tidy(job.companyName)) lines.push(`Company: ${tidy(job.companyName)}`);
  if (job.seniority && tidy(job.seniority)) lines.push(`Level: ${tidy(job.seniority)}`);
  lines.push(...section("What the person will do", job.responsibilities), ...section("Requirements", job.requirements), ...section("Nice to have", job.niceToHave));

  const tools = job.tools.map(tidy).filter(Boolean).slice(0, MAX_ITEMS);
  if (tools.length > 0) lines.push("", `Tools and technologies: ${tools.join(", ")}`);
  return lines.join("\n");
}
