import "server-only";

import { z } from "zod";

import { isThinPage, type Page } from "./job-posting";

/**
 * The only place the app talks to Apify (docs/adr/0002). It runs Apify's RAG Web Browser on one link and
 * gets the page back as Markdown. Only the link is sent, never the résumé or anything from the interview.
 */

export type JobPageFailure = "not-configured" | "rejected" | "no-credit" | "timeout" | "failed" | "empty";

const INSTEAD = "Paste the text of the posting instead.";
const MESSAGES: Record<JobPageFailure, string> = {
  "not-configured": `Reading a link is not set up yet. ${INSTEAD}`,
  rejected: `Reading a link is not available right now. ${INSTEAD}`,
  "no-credit": `Reading a link is not available right now. ${INSTEAD}`,
  timeout: `Reading the page took too long. ${INSTEAD}`,
  failed: `Could not read that page. ${INSTEAD}`,
  empty: `Could not read that page. ${INSTEAD}`,
};

/** A failure with a message that is safe to show, and a code for the server log. */
export class JobPageError extends Error {
  constructor(
    message: string,
    readonly code: JobPageFailure,
  ) {
    super(message);
    this.name = "JobPageError";
  }
}

const fail = (code: JobPageFailure) => new JobPageError(MESSAGES[code], code);

const ENDPOINT = "https://api.apify.com/v2/acts/apify~rag-web-browser/run-sync-get-dataset-items";

/** The whole job route has to fit in one function call (60 s): the read, a browser retry, and the model. */
export const READ_BUDGET_MS = 50_000;
/** What the model call after the read needs. */
const MODEL_RESERVE_SECS = 8;
/** Not worth starting a browser run with less than this left. */
const MIN_BROWSER_SECS = 15;

type Tool = "raw-http" | "browser-playwright";

/** Plain HTTP takes about 8 s and costs a fifth of a browser run; the browser takes 20 to 40 s. */
const RUNS: Record<Tool, { maxSecs: number; memoryMb: number }> = {
  "raw-http": { maxSecs: 20, memoryMb: 1024 },
  "browser-playwright": { maxSecs: 40, memoryMb: 2048 },
};

const ItemsSchema = z.array(
  z.object({
    markdown: z.string().nullish(),
    metadata: z.object({ title: z.string().nullish(), url: z.string().nullish(), redirectedUrl: z.string().nullish() }).nullish(),
    crawl: z.object({ httpStatusCode: z.number().nullish() }).nullish(),
  }),
);

function apiToken(): string | null {
  return process.env.APIFY_TOKEN?.trim() || null;
}

/** One run of the Actor: waits for it, and returns the page it loaded. */
async function runActor(requestedUrl: string, tool: Tool, token: string, deadline: number): Promise<Page> {
  const { maxSecs, memoryMb } = RUNS[tool];
  const timeoutSecs = Math.min(maxSecs, Math.floor((deadline - Date.now()) / 1000) - MODEL_RESERVE_SECS);
  if (timeoutSecs < 5) throw fail("timeout");

  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}?timeout=${timeoutSecs}&memory=${memoryMb}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: requestedUrl, maxResults: 1, outputFormats: ["markdown"], scrapingTool: tool, requestTimeoutSecs: Math.max(5, timeoutSecs - 3) }),
      // The run has its own timeout; this one only guards against an answer that never comes.
      signal: AbortSignal.timeout((timeoutSecs + 5) * 1000),
      cache: "no-store",
    });
  } catch (error) {
    throw error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError") ? fail("timeout") : fail("failed");
  }

  if (response.status === 401 || response.status === 403) throw fail("rejected");
  if (response.status === 402) throw fail("no-credit");
  if (response.status === 408) throw fail("timeout");
  if (!response.ok) throw fail("failed");

  const items = ItemsSchema.safeParse(await response.json().catch(() => null));
  const item = items.success ? items.data[0] : undefined;
  if (!item) throw fail("empty");

  return {
    requestedUrl,
    finalUrl: item.metadata?.url || item.metadata?.redirectedUrl || requestedUrl,
    title: item.metadata?.title ?? "",
    status: item.crawl?.httpStatusCode ?? null,
    text: item.markdown ?? "",
  };
}

/** The page really is gone: a browser would only read the same error page. */
const GONE = new Set([404, 410]);
/** Sites that turn plain HTTP away but may let a real browser through. */
const TURNED_AWAY = new Set([401, 403, 429]);

function needsBrowser(page: Page): boolean {
  if (page.status !== null && GONE.has(page.status)) return false;
  return isThinPage(page.text) || (page.status !== null && (TURNED_AWAY.has(page.status) || page.status >= 500));
}

/** Failures of the plain read that a browser run might get around. A rejected token or an empty account would fail again. */
const RETRYABLE = new Set<JobPageFailure>(["timeout", "failed", "empty"]);

/**
 * Reads the page a link points to. Plain HTTP goes first because it is quick and cheap and most job boards
 * (Lever, Greenhouse, Gupy) answer it in full. A page that comes back with no text, or that turned plain
 * HTTP away, gets a second run in a real browser (script-only boards such as Ashby).
 */
export async function readPage(requestedUrl: string, options: { deadline?: number } = {}): Promise<Page> {
  const token = apiToken();
  if (!token) throw fail("not-configured");
  const deadline = options.deadline ?? Date.now() + READ_BUDGET_MS;

  let plain: Page | null = null;
  let plainError: JobPageError | null = null;
  try {
    plain = await runActor(requestedUrl, "raw-http", token, deadline);
  } catch (error) {
    if (!(error instanceof JobPageError) || !RETRYABLE.has(error.code)) throw error;
    plainError = error;
  }

  if (plain && !needsBrowser(plain)) return plain;

  const secsLeft = (deadline - Date.now()) / 1000 - MODEL_RESERVE_SECS;
  if (secsLeft < MIN_BROWSER_SECS) {
    if (plain) return plain;
    throw plainError ?? fail("timeout");
  }

  try {
    const browser = await runActor(requestedUrl, "browser-playwright", token, deadline);
    return !plain || browser.text.length > plain.text.length ? browser : plain;
  } catch (error) {
    if (plain) return plain;
    throw error;
  }
}
