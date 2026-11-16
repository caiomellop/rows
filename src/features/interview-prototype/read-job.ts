"use server";

import { after } from "next/server";

import { extractJob } from "@/lib/ai";

import { readPage, warmUp } from "./apify";
import { prototypeEnabled } from "./gate";
import { jobToText } from "./job-posting";
import { jobUrlFrom } from "./job-url";
import { logFailure, safeMessage } from "./route-utils";
import { JobRequestSchema, type ReadJobResult } from "./schemas";

/**
 * Reads the job posting a link points to and keeps only what the interview needs: the role, the work and the
 * requirements, without the company's mission, values or boilerplate (docs/adr/0002).
 *
 * The form calls this as soon as the "Job posting URL" field holds a complete link. It is a Server Action and not a
 * route because it answers one page and nothing else calls it. Anyone can still send it a request, so it checks the
 * gate and the address itself, and answers with messages that are safe to show.
 */

const INSTEAD = "Paste the text of the posting instead.";
const NOT_A_POSTING = `No job posting was found at that address. ${INSTEAD}`;
const UNAVAILABLE = `Reading a link is not available right now. ${INSTEAD}`;
const FAILED = `Could not read that page. ${INSTEAD}`;

const fail = (error: string): ReadJobResult => ({ ok: false, error });

export async function readJobPosting(input: unknown): Promise<ReadJobResult> {
  if (!prototypeEnabled()) return fail(UNAVAILABLE);

  const parsed = JobRequestSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "That link cannot be read.");
  const url = jobUrlFrom(parsed.data.url) ?? parsed.data.url;

  try {
    const readStartedAt = Date.now();
    const page = await readPage(url);
    const readMs = Date.now() - readStartedAt;
    // A page that did not load (not found, gone, forbidden) has no posting, so the model is not asked.
    if (page.status !== null && page.status >= 400) return fail(NOT_A_POSTING);

    const modelStartedAt = Date.now();
    const { job, usage } = await extractJob(page);
    // Only numbers, so the next speed-up can be aimed at what is slow. Never the link, the text or the result.
    console.info("[interview-prototype] read-job", { readMs, modelMs: Date.now() - modelStartedAt, inputTokens: usage.input, outputTokens: usage.output });
    if (!job.isJobPosting || (job.requirements.length === 0 && job.responsibilities.length === 0)) return fail(NOT_A_POSTING);

    return {
      ok: true,
      jobDescription: jobToText(job),
      roleTitle: job.roleTitle.replace(/[<>]/g, "").trim().slice(0, 200),
      companyName: job.companyName?.replace(/[<>]/g, "").trim().slice(0, 200) || null,
      usage,
    };
  } catch (error) {
    logFailure("read-job", error);
    return fail(safeMessage(error, FAILED));
  }
}

/**
 * Called when the page opens, so the Apify server is awake by the time a link is pasted. It answers at once and does
 * the work after the response: Next.js sends Server Actions one at a time, and a warm-up that held the line would
 * make a link pasted right after opening the page wait for it. Where the prototype is off, it does nothing.
 */
export async function warmUpJobReader(): Promise<void> {
  if (!prototypeEnabled()) return;
  after(() => warmUp());
}
