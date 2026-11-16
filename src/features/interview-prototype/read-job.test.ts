import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const ai = vi.hoisted(() => {
  class AiError extends Error {}
  return { AiError, extractJob: vi.fn() };
});
vi.mock("@/lib/ai", () => ai);

// Reading a page is mocked; the error type stays real, because the action decides what to show from it.
const apify = vi.hoisted(() => ({ readPage: vi.fn() }));
vi.mock("./apify", async (importActual) => ({ ...(await importActual<typeof import("./apify")>()), readPage: apify.readPage }));

import { JobPageError } from "./apify";
import { readJobPosting } from "./read-job";

const link = "https://jobs.lever.co/Flex/151e09c6-398f-4fe0-8da7-8fd7814d1bae";
const page = { requestedUrl: link, finalUrl: link, title: "Flex - Senior Software Engineer, Backend", status: 200, text: "What You Need: NodeJS and TypeScript. Flex is building AI-native financial services." };
const usage = { input: 1200, output: 40, cacheRead: 1000, cacheWrite: 0 };
const job = {
  isJobPosting: true,
  roleTitle: "Senior Software Engineer, Backend",
  companyName: "Flex",
  seniority: "Senior",
  responsibilities: ["Own card processing"],
  requirements: ["Proficiency in NodeJS and TypeScript"],
  niceToHave: [],
  tools: ["NodeJS"],
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.stubEnv("PROTOTYPE_ENABLED", "true");
});
afterEach(() => vi.unstubAllEnvs());

describe("when the prototype is not enabled", () => {
  it("reads nothing and spends nothing", async () => {
    vi.stubEnv("PROTOTYPE_ENABLED", "");
    const result = await readJobPosting({ url: link });
    expect(result.ok).toBe(false);
    expect(apify.readPage).not.toHaveBeenCalled();
    expect(ai.extractJob).not.toHaveBeenCalled();
  });
});

describe("reading a job posting from a link", () => {
  it("reads the page and returns what the model kept as the job description, with the role, the company and what the model cost", async () => {
    apify.readPage.mockResolvedValue(page);
    ai.extractJob.mockResolvedValue({ job, usage });

    const result = await readJobPosting({ url: ` ${link} ` });

    expect(result).toEqual({
      ok: true,
      roleTitle: "Senior Software Engineer, Backend",
      companyName: "Flex",
      usage,
      jobDescription: [
        "Role: Senior Software Engineer, Backend",
        "Company: Flex",
        "Level: Senior",
        "",
        "What the person will do:",
        "- Own card processing",
        "",
        "Requirements:",
        "- Proficiency in NodeJS and TypeScript",
        "",
        "Tools and technologies: NodeJS",
      ].join("\n"),
    });
    expect(apify.readPage).toHaveBeenCalledWith(link);
    expect(ai.extractJob).toHaveBeenCalledWith(page);
  });

  it("logs how long the page and the model took, and how many tokens, and nothing about the posting", async () => {
    apify.readPage.mockResolvedValue(page);
    ai.extractJob.mockResolvedValue({ job, usage });

    await readJobPosting({ url: link });

    expect(console.info).toHaveBeenCalledWith("[interview-prototype] read-job", { readMs: expect.any(Number), modelMs: expect.any(Number), inputTokens: 1200, outputTokens: 40 });
    const logged = JSON.stringify(vi.mocked(console.info).mock.calls);
    for (const secret of ["lever.co", "Flex", "NodeJS", "card processing"]) expect(logged).not.toContain(secret);
  });

  it("has no company to show when the page does not name one", async () => {
    apify.readPage.mockResolvedValue(page);
    ai.extractJob.mockResolvedValue({ job: { ...job, companyName: null }, usage });
    expect(await readJobPosting({ url: link })).toMatchObject({ ok: true, companyName: null });
  });

  it("says no posting was found when the model sees a list, a closed job or a wall", async () => {
    apify.readPage.mockResolvedValue({ ...page, finalUrl: "https://job-boards.greenhouse.io/reddit?error=true" });
    ai.extractJob.mockResolvedValue({ job: { ...job, isJobPosting: false, roleTitle: "", responsibilities: [], requirements: [] }, usage });

    const result = await readJobPosting({ url: link });

    expect(result).toMatchObject({ ok: false });
    expect(result.ok === false && result.error).toContain("No job posting was found");
  });

  it("says the same when the page lists neither the work nor the requirements", async () => {
    apify.readPage.mockResolvedValue(page);
    ai.extractJob.mockResolvedValue({ job: { ...job, responsibilities: [], requirements: [], niceToHave: ["A plus"] }, usage });
    expect(await readJobPosting({ url: link })).toMatchObject({ ok: false, error: expect.stringContaining("No job posting was found") });
  });

  it("does not ask the model about a page that did not load", async () => {
    apify.readPage.mockResolvedValue({ ...page, status: 404, text: "Page not found" });
    expect(await readJobPosting({ url: link })).toMatchObject({ ok: false });
    expect(ai.extractJob).not.toHaveBeenCalled();
  });

  it.each([undefined, null, {}, { url: "" }, { url: "not a link" }, { url: "http://localhost:3000/jobs/1" }, { url: "http://192.168.0.1/admin" }, { url: "ftp://example.com/job" }, { url: "https://user:pw@example.com/job" }])(
    "refuses %j before spending anything",
    async (bad) => {
      expect(await readJobPosting(bad)).toMatchObject({ ok: false });
      expect(apify.readPage).not.toHaveBeenCalled();
      expect(ai.extractJob).not.toHaveBeenCalled();
    },
  );

  it("shows our own message when the page cannot be read", async () => {
    apify.readPage.mockRejectedValueOnce(new JobPageError("Reading the page took too long. Paste the text of the posting instead.", "timeout"));
    expect(await readJobPosting({ url: link })).toEqual({ ok: false, error: "Reading the page took too long. Paste the text of the posting instead." });

    apify.readPage.mockRejectedValueOnce(new JobPageError("Reading a link is not set up yet. Paste the text of the posting instead.", "not-configured"));
    expect(await readJobPosting({ url: link })).toEqual({ ok: false, error: "Reading a link is not set up yet. Paste the text of the posting instead." });
  });

  it("hides raw errors from Apify or the model, and logs only the kind of failure", async () => {
    apify.readPage.mockRejectedValue(new Error("401 apify_api_SECRET"));
    const result = await readJobPosting({ url: link });
    expect(result).toEqual({ ok: false, error: "Could not read that page. Paste the text of the posting instead." });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("SECRET");
  });
});
