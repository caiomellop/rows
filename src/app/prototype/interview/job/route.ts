import { JobPageError, readPage } from "@/features/interview-prototype/apify";
import { disabledResponse, prototypeEnabled } from "@/features/interview-prototype/gate";
import { jobToText } from "@/features/interview-prototype/job-posting";
import { jobUrlFrom } from "@/features/interview-prototype/job-url";
import { logFailure, safeMessage } from "@/features/interview-prototype/route-utils";
import { JobRequestSchema, type JobResponse } from "@/features/interview-prototype/schemas";
import { extractJob } from "@/lib/ai";

/** Reading a page and asking the model can take most of a minute. */
export const maxDuration = 60;

const NOT_A_POSTING = "No job posting was found at that address. Paste the text of the posting instead.";

/**
 * Reads the job posting a link points to and keeps only what the interview needs: the role, the work and
 * the requirements, without the company's mission, values or boilerplate.
 */
export async function POST(request: Request) {
  if (!prototypeEnabled()) return disabledResponse();

  const parsed = JobRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  const url = jobUrlFrom(parsed.data.url) ?? parsed.data.url;

  try {
    const page = await readPage(url);
    // A page that did not load (not found, gone, forbidden) has no posting, so the model is not asked.
    if (page.status !== null && page.status >= 400) return Response.json({ error: NOT_A_POSTING }, { status: 422 });

    const { job, usage } = await extractJob(page);
    if (!job.isJobPosting || (job.requirements.length === 0 && job.responsibilities.length === 0)) {
      return Response.json({ error: NOT_A_POSTING }, { status: 422 });
    }

    const body: JobResponse = { jobDescription: jobToText(job), usage };
    return Response.json(body);
  } catch (error) {
    logFailure("job", error);
    const status = error instanceof JobPageError && error.code === "not-configured" ? 503 : 502;
    return Response.json({ error: safeMessage(error, "Could not read that page. Paste the text of the posting instead.") }, { status });
  }
}
