import "server-only";

import { z } from "zod";

import { isThinPage, type Page } from "./job-posting";

/**
 * The only place the app talks to Apify (docs/adr/0002). It asks Apify's RAG Web Browser for one link and
 * gets the page back as Markdown. Only the link is sent, never the résumé or anything from the interview.
 *
 * It uses the Actor's own server (always running), not a new run per link: a run starts a container first, which
 * took about 8 s even for a page that loads in one.
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

const ENDPOINT = "https://rag-web-browser.apify.actor/search";

/** The whole job route has to fit in one function call (60 s): the read, a browser retry, and the model. */
export const READ_BUDGET_MS = 50_000;
/** What the model call after the read needs. */
const MODEL_RESERVE_SECS = 8;
/** Not worth starting a browser run with less than this left. */
const MIN_BROWSER_SECS = 15;

type Tool = "raw-http" | "browser-playwright";

/** The longest to wait for each way of reading. The server answers a plain read in a few seconds; a browser takes longer. */
const MAX_WAIT_SECS: Record<Tool, number> = { "raw-http": 15, "browser-playwright": 30 };

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

/** One read of the page: waits for the server's answer, and returns the page it loaded. */
async function readOnce(requestedUrl: string, tool: Tool, token: string, deadline: number): Promise<Page> {
  const timeoutSecs = Math.min(MAX_WAIT_SECS[tool], Math.floor((deadline - Date.now()) / 1000) - MODEL_RESERVE_SECS);
  if (timeoutSecs < 5) throw fail("timeout");

  // The link is sent as a query parameter, like any search; the token goes in a header, never in the address.
  const query = new URLSearchParams({ query: requestedUrl, maxResults: "1", outputFormats: "markdown", scrapingTool: tool, removeCookieWarnings: "false" });
  const startedAt = Date.now();
  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
      // The server has no time limit of its own to set, so this one is the limit.
      signal: AbortSignal.timeout(timeoutSecs * 1000),
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

  const page: Page = {
    requestedUrl,
    finalUrl: item.metadata?.url || item.metadata?.redirectedUrl || requestedUrl,
    title: item.metadata?.title ?? "",
    status: item.crawl?.httpStatusCode ?? null,
    text: item.markdown ?? "",
  };
  // Only numbers: how long it took and how much came back. Never the link or the text of the page.
  console.info("[interview-prototype] page read", { tool, ms: Date.now() - startedAt, status: page.status, chars: page.text.length });
  return page;
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
    plain = await readOnce(requestedUrl, "raw-http", token, deadline);
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
    const browser = await readOnce(requestedUrl, "browser-playwright", token, deadline);
    return !plain || browser.text.length > plain.text.length ? browser : plain;
  } catch (error) {
    if (plain) return plain;
    throw error;
  }
}
