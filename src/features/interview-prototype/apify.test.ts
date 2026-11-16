import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { JobPageError, readPage } from "./apify";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const LINK = "https://jobs.lever.co/Flex/151e09c6";
const LONG = "Requirement text. ".repeat(60);

const item = (over: { markdown?: string; status?: number; url?: string; title?: string } = {}) => ({
  markdown: over.markdown ?? LONG,
  metadata: { title: over.title ?? "Flex - Senior Engineer", url: over.url ?? LINK },
  crawl: { httpStatusCode: over.status ?? 200 },
});
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** Answers the calls in order; an Error is thrown instead of returned, like a failed network call. */
function stub(...responses: (Response | Error)[]) {
  const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => {
    const next = responses.shift();
    if (!next) throw new Error("unexpected extra call");
    if (next instanceof Error) throw next;
    return next;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
const sentTool = (fetchMock: ReturnType<typeof stub>, call: number) => new URL(fetchMock.mock.calls[call][0]).searchParams.get("scrapingTool");
const failure = async () => (await readPage(LINK).catch((error: unknown) => error)) as JobPageError;
const timeout = () => new DOMException("The operation timed out.", "TimeoutError");

describe("reading a page", () => {
  it("asks the RAG Web Browser's server for the link, plain HTTP first, with the token in a header and not in the address", async () => {
    vi.stubEnv("APIFY_TOKEN", "secret-token");
    const fetchMock = stub(reply([item()]));

    const page = await readPage(LINK);

    const [url, init] = fetchMock.mock.calls[0];
    const address = new URL(url);
    // The Actor's own server, which is always running: a new run per link would start a container first.
    expect(`${address.origin}${address.pathname}`).toBe("https://rag-web-browser.apify.actor/search");
    expect(url).not.toContain("secret-token");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret-token");
    expect(init.method).toBeUndefined();
    expect(init.body).toBeUndefined();
    expect(Object.fromEntries(address.searchParams)).toEqual({ query: LINK, maxResults: "1", outputFormats: "markdown", scrapingTool: "raw-http", removeCookieWarnings: "false" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(page).toEqual({ requestedUrl: LINK, finalUrl: LINK, title: "Flex - Senior Engineer", status: 200, text: LONG });
  });

  it("reports where the page really loaded from, so a redirect to a list of jobs can be seen", async () => {
    vi.stubEnv("APIFY_TOKEN", "t");
    stub(reply([item({ url: "https://job-boards.greenhouse.io/reddit?error=true", title: "Jobs at Reddit" })]));
    const page = await readPage("https://job-boards.greenhouse.io/reddit/jobs/8093006");
    expect(page.finalUrl).toBe("https://job-boards.greenhouse.io/reddit?error=true");
    expect(page.requestedUrl).toBe("https://job-boards.greenhouse.io/reddit/jobs/8093006");
  });
});

describe("what is logged", () => {
  it("is only how long a read took and how much came back, never the link or the text", async () => {
    vi.stubEnv("APIFY_TOKEN", "secret-token");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    stub(reply([item({ markdown: LONG })]));

    await readPage(LINK);

    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0][1]).toEqual({ tool: "raw-http", ms: expect.any(Number), status: 200, chars: LONG.length });
    const logged = JSON.stringify(info.mock.calls);
    expect(logged).not.toContain("lever.co");
    expect(logged).not.toContain("secret-token");
    expect(logged).not.toContain("Requirement text");
    info.mockRestore();
  });
});

describe("when plain HTTP is not enough", () => {
  it("retries in a real browser when the page came back with no text (script-only boards), and keeps the longer page", async () => {
    vi.stubEnv("APIFY_TOKEN", "t");
    const fetchMock = stub(reply([item({ markdown: "Software Engineer @ Flossy" })]), reply([item()]));
    const page = await readPage(LINK);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect([sentTool(fetchMock, 0), sentTool(fetchMock, 1)]).toEqual(["raw-http", "browser-playwright"]);
    expect(page.text).toBe(LONG);
  });

  it("retries in a browser when the site turned plain HTTP away", async () => {
    vi.stubEnv("APIFY_TOKEN", "t");
    const fetchMock = stub(reply([item({ markdown: "Access denied. ".repeat(60), status: 403 })]), reply([item()]));
    const page = await readPage(LINK);
    expect(sentTool(fetchMock, 1)).toBe("browser-playwright");
    expect(page.status).toBe(200);
  });

  it("retries in a browser when the plain run times out", async () => {
    vi.stubEnv("APIFY_TOKEN", "t");
    const fetchMock = stub(timeout(), reply([item()]));
    expect((await readPage(LINK)).text).toBe(LONG);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps the plain page when the browser run fails", async () => {
    vi.stubEnv("APIFY_TOKEN", "t");
    stub(reply([item({ markdown: "Short page" })]), reply({}, 500));
    expect((await readPage(LINK)).text).toBe("Short page");
  });

  it("does not run a browser for a page that is really gone, because it would read the same error", async () => {
    vi.stubEnv("APIFY_TOKEN", "t");
    const fetchMock = stub(reply([item({ markdown: "Page not found", status: 404 })]));
    expect((await readPage(LINK)).status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not start a browser run when there is not enough time left for it and the model", async () => {
    vi.stubEnv("APIFY_TOKEN", "t");
    const fetchMock = stub(reply([item({ markdown: "Short page" })]));
    const page = await readPage(LINK, { deadline: Date.now() + 20_000 });
    expect(page.text).toBe("Short page");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fails with a timeout when the plain run failed and there is no time for a browser", async () => {
    vi.stubEnv("APIFY_TOKEN", "t");
    stub(timeout());
    const error = (await readPage(LINK, { deadline: Date.now() + 20_000 }).catch((e: unknown) => e)) as JobPageError;
    expect(error).toBeInstanceOf(JobPageError);
    expect(error.code).toBe("timeout");
  });
});

describe("when Apify cannot help", () => {
  it("says links are not set up when there is no token, and calls nobody", async () => {
    const fetchMock = stub();
    const error = await failure();
    expect(error).toBeInstanceOf(JobPageError);
    expect(error.code).toBe("not-configured");
    expect(error.message).toContain("not set up yet");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [401, "rejected", "not available right now"],
    [403, "rejected", "not available right now"],
    [402, "no-credit", "not available right now"],
  ])("answers %i with the code %s and a plain message, and does not retry", async (status, code, message) => {
    vi.stubEnv("APIFY_TOKEN", "secret-token");
    const fetchMock = stub(reply({ error: { message: "secret-token is bad" } }, status));
    const error = await failure();
    expect(error.code).toBe(code);
    expect(error.message).toContain(message);
    expect(error.message).not.toContain("secret-token");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("explains a run that took too long, after trying both ways", async () => {
    vi.stubEnv("APIFY_TOKEN", "t");
    const fetchMock = stub(reply({}, 408), timeout());
    const error = await failure();
    expect(error.code).toBe("timeout");
    expect(error.message).toContain("took too long");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("explains an answer with no page in it, after trying both ways", async () => {
    vi.stubEnv("APIFY_TOKEN", "t");
    stub(reply([]), reply("not json at all"));
    const error = await failure();
    expect(error.code).toBe("empty");
    expect(error.message).toContain("Could not read that page");
  });

  it("explains a server error, after trying both ways", async () => {
    vi.stubEnv("APIFY_TOKEN", "t");
    stub(reply({}, 500), new Error("socket hang up"));
    const error = await failure();
    expect(error.code).toBe("failed");
  });
});
