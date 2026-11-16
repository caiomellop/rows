import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const ai = vi.hoisted(() => {
  class AiError extends Error {}
  return { AiError, planInterview: vi.fn(), streamInterviewerTurn: vi.fn(), interviewFeedback: vi.fn(), extractJob: vi.fn() };
});
vi.mock("@/lib/ai", () => ai);

// Reading a page is mocked; the error type stays real, because the route decides what to show from it.
const apify = vi.hoisted(() => ({ readPage: vi.fn() }));
vi.mock("@/features/interview-prototype/apify", async (importActual) => ({
  ...(await importActual<typeof import("@/features/interview-prototype/apify")>()),
  readPage: apify.readPage,
}));

// The token call is mocked; the choice of voice runs for real.
const deepgram = vi.hoisted(() => ({ mintBrowserToken: vi.fn() }));
vi.mock("@/features/interview-prototype/deepgram", async (importActual) => ({
  ...(await importActual<typeof import("@/features/interview-prototype/deepgram")>()),
  mintBrowserToken: deepgram.mintBrowserToken,
}));

import { JobPageError } from "@/features/interview-prototype/apify";
import { applyMove, startState } from "@/features/interview-prototype/state";
import type { Plan, PlanDraft } from "@/features/interview-prototype/schemas";

import { POST as feedback } from "./feedback/route";
import { POST as readJob } from "./job/route";
import { POST as session } from "./session/route";
import { POST as turn } from "./turn/route";

// What the planner model writes has no language: the session route adds it from the chosen voice.
const draft: PlanDraft = {
  roleTitle: "Backend Engineer",
  companyName: null,
  questions: [
    { topic: "Background", question: "Walk me through your background.", lookFor: "Relevant experience." },
    { topic: "APIs", question: "How do you design a public API?", lookFor: "Versioning and errors." },
    { topic: "Conflict", question: "Tell me about a disagreement.", lookFor: "Their own role." },
  ],
};
const plan: Plan = { ...draft, language: "en" };
const jobDescription = "We are hiring a backend engineer to build and run payment APIs in Go and PostgreSQL.";
const usage = { input: 1200, output: 40, cacheRead: 1000, cacheWrite: 0 };

const post = (body: unknown) => new Request("http://localhost/prototype", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const lines = async (response: Response) =>
  (await response.text())
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));

async function* modelStream(...events: unknown[]) {
  for (const event of events) yield event;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.unstubAllEnvs());

describe("when the prototype is not enabled", () => {
  it("answers 404 on every route and calls nobody", async () => {
    for (const route of [session, turn, feedback, readJob]) expect((await route(post({}))).status).toBe(404);
    expect(ai.planInterview).not.toHaveBeenCalled();
    expect(ai.streamInterviewerTurn).not.toHaveBeenCalled();
    expect(ai.extractJob).not.toHaveBeenCalled();
    expect(apify.readPage).not.toHaveBeenCalled();
    expect(deepgram.mintBrowserToken).not.toHaveBeenCalled();
  });

  it("stays closed for any value other than true", async () => {
    vi.stubEnv("PROTOTYPE_ENABLED", "1");
    expect((await session(post({}))).status).toBe(404);
  });
});

describe("when enabled", () => {
  beforeEach(() => vi.stubEnv("PROTOTYPE_ENABLED", "true"));

  describe("start", () => {
    it("asks for the job description when it is too short", async () => {
      const response = await session(post({ jobDescription: "Engineer", durationMinutes: 15 }));
      expect(response.status).toBe(400);
      expect((await response.json()).error).toContain("job description");
    });

    it("refuses a duration that is not offered", async () => {
      expect((await session(post({ jobDescription, durationMinutes: 45 }))).status).toBe(400);
    });

    it("returns the plan, the time budget and a browser token with the socket addresses", async () => {
      ai.planInterview.mockResolvedValue({ plan: draft, usage });
      deepgram.mintBrowserToken.mockResolvedValue("browser-token");

      const response = await session(post({ jobDescription, resume: "", durationMinutes: 15 }));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.plan).toEqual(plan);
      expect(body.budgetMs).toBe(15 * 60_000);
      expect(body.deepgram.token).toBe("browser-token");
      expect(body.deepgram.listenUrl).toContain("wss://api.deepgram.com/v2/listen");
      expect(body.deepgram.speakUrl).toContain("model=flux-cliff-en");
      expect(deepgram.mintBrowserToken).toHaveBeenCalledWith(15 * 60 + 600);
    });

    it.each([
      { name: "Cliff (the default)", voice: undefined, language: "en", model: "flux-cliff-en", speed: "0.9", expressivity: "1" },
      { name: "Sienna", voice: "sienna", language: "en", model: "flux-sienna-en", speed: "0.9", expressivity: "1" },
      { name: "Eduardo", voice: "eduardo", language: "es", model: "flux-eduardo-es", speed: "0.9", expressivity: "0" },
      { name: "Roberto", voice: "roberto", language: "pt", model: "flux-roberto-pt", speed: "0.9", expressivity: "1" },
      { name: "Mathieu", voice: "mathieu", language: "fr", model: "flux-mathieu-fr", speed: "0.9", expressivity: "0" },
    ])("$name sets the interview language, the voice settings and the speech hint", async ({ voice, language, model, speed, expressivity }) => {
      ai.planInterview.mockResolvedValue({ plan: draft, usage });
      deepgram.mintBrowserToken.mockResolvedValue("t");

      const body = await (await session(post({ jobDescription, durationMinutes: 10, voice }))).json();

      const speak = new URL(body.deepgram.speakUrl);
      expect([speak.searchParams.get("model"), speak.searchParams.get("speed"), speak.searchParams.get("expressivity")]).toEqual([model, speed, expressivity]);
      expect(new URL(body.deepgram.listenUrl).searchParams.getAll("language_hint")).toEqual([language]);
      expect(ai.planInterview).toHaveBeenCalledWith(expect.objectContaining({ language }));
      expect(body.plan.language).toBe(language);
    });

    it("refuses a voice that is not offered", async () => {
      expect((await session(post({ jobDescription, durationMinutes: 10, voice: "alexis" }))).status).toBe(400);
    });

    it("shows our own message for a known failure and a generic one for anything else", async () => {
      deepgram.mintBrowserToken.mockResolvedValue("t");
      ai.planInterview.mockRejectedValueOnce(new ai.AiError("The AI is busy right now. Try again in a minute."));
      const known = await session(post({ jobDescription, durationMinutes: 10 }));
      expect(known.status).toBe(502);
      expect((await known.json()).error).toBe("The AI is busy right now. Try again in a minute.");

      ai.planInterview.mockRejectedValueOnce(new Error("401 invalid x-api-key sk-ant-SECRET"));
      const unknown = await session(post({ jobDescription, durationMinutes: 10 }));
      const text = JSON.stringify(await unknown.json());
      expect(text).toContain("Could not start the interview");
      expect(text).not.toContain("sk-ant");
    });

    it("does not start an interview from a plan with almost no questions", async () => {
      ai.planInterview.mockResolvedValue({ plan: { ...plan, questions: plan.questions.slice(0, 1) }, usage });
      deepgram.mintBrowserToken.mockResolvedValue("t");
      expect((await session(post({ jobDescription, durationMinutes: 10 }))).status).toBe(502);
    });
  });

  describe("turn", () => {
    const request = () => post({ jobDescription, resume: "", plan, state: applyMove(startState(900_000), "NEXT", plan) });

    it("streams the move first, then the words to speak, then the usage", async () => {
      ai.streamInterviewerTurn.mockReturnValue(
        modelStream({ type: "text", text: "[[FOLLOW" }, { type: "text", text: "_UP]] Could you" }, { type: "text", text: " give an example?" }, { type: "done", usage }),
      );
      const response = await turn(request());
      expect(response.headers.get("content-type")).toContain("application/x-ndjson");
      expect(await lines(response)).toEqual([
        { t: "move", move: "FOLLOW_UP" },
        { t: "text", text: "Could you" },
        { t: "text", text: " give an example?" },
        { t: "done", usage },
      ]);
      const call = ai.streamInterviewerTurn.mock.calls[0][0];
      expect(call.system).toContain(jobDescription);
      expect(call.messages.at(-1).role).toBe("user");
    });

    it("reports a reply that has no move tag, and still speaks it", async () => {
      ai.streamInterviewerTurn.mockReturnValue(modelStream({ type: "text", text: "Tell me more about that." }, { type: "done", usage }));
      expect(await lines(await turn(request()))).toEqual([{ t: "move", move: null }, { t: "text", text: "Tell me more about that." }, { t: "done", usage }]);
    });

    it("reports a failure as an event instead of a broken stream", async () => {
      ai.streamInterviewerTurn.mockImplementation(async function* () {
        yield { type: "text", text: "[[NEXT]] Okay." };
        throw new Error("upstream exploded with a stack trace");
      });
      const events = await lines(await turn(request()));
      expect(events.at(-1)).toEqual({ t: "error", message: "The interviewer could not answer. Try again." });
    });

    it("rejects a malformed state", async () => {
      expect((await turn(post({ jobDescription, plan, state: { stage: "nope" } }))).status).toBe(400);
    });
  });

  describe("feedback", () => {
    const body = { jobDescription, plan, transcript: [{ role: "interviewer", text: "Hi.", at: 1 }, { role: "candidate", text: "Hello.", at: 4 }] };

    it("returns the report and what it cost", async () => {
      const report = { summary: "Good.", scores: [], strengths: ["a"], improvements: ["b"] };
      ai.interviewFeedback.mockResolvedValue({ feedback: report, usage });
      const response = await feedback(post(body));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ feedback: report, usage });
    });

    it("needs a transcript", async () => {
      expect((await feedback(post({ ...body, transcript: [] }))).status).toBe(400);
    });

    it("hides raw errors", async () => {
      ai.interviewFeedback.mockRejectedValue(new Error("boom with sk-ant-SECRET"));
      const response = await feedback(post(body));
      expect(response.status).toBe(502);
      expect(JSON.stringify(await response.json())).not.toContain("SECRET");
    });
  });

  describe("job from a link", () => {
    const link = "https://jobs.lever.co/Flex/151e09c6-398f-4fe0-8da7-8fd7814d1bae";
    const page = { requestedUrl: link, finalUrl: link, title: "Flex - Senior Software Engineer, Backend", status: 200, text: "What You Need: NodeJS and TypeScript. Flex is building AI-native financial services." };
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

    it("reads the page and returns what the model kept as the job description, with what the model cost", async () => {
      apify.readPage.mockResolvedValue(page);
      ai.extractJob.mockResolvedValue({ job, usage });

      const response = await readJob(post({ url: ` ${link} ` }));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.usage).toEqual(usage);
      expect(body.jobDescription).toBe(
        [
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
      );
      expect(apify.readPage).toHaveBeenCalledWith(link);
      expect(ai.extractJob).toHaveBeenCalledWith(page);
    });

    it("says no posting was found when the model sees a list, a closed job or a wall", async () => {
      apify.readPage.mockResolvedValue({ ...page, finalUrl: "https://job-boards.greenhouse.io/reddit?error=true" });
      ai.extractJob.mockResolvedValue({ job: { ...job, isJobPosting: false, roleTitle: "", responsibilities: [], requirements: [] }, usage });

      const response = await readJob(post({ url: link }));

      expect(response.status).toBe(422);
      expect((await response.json()).error).toContain("No job posting was found");
    });

    it("says the same when the page lists neither the work nor the requirements", async () => {
      apify.readPage.mockResolvedValue(page);
      ai.extractJob.mockResolvedValue({ job: { ...job, responsibilities: [], requirements: [], niceToHave: ["A plus"] }, usage });
      expect((await readJob(post({ url: link }))).status).toBe(422);
    });

    it("does not ask the model about a page that did not load", async () => {
      apify.readPage.mockResolvedValue({ ...page, status: 404, text: "Page not found" });
      const response = await readJob(post({ url: link }));
      expect(response.status).toBe(422);
      expect(ai.extractJob).not.toHaveBeenCalled();
    });

    it.each(["", "not a link", "http://localhost:3000/jobs/1", "http://192.168.0.1/admin", "ftp://example.com/job", "https://user:pw@example.com/job"])(
      "refuses %j before spending anything",
      async (bad) => {
        const response = await readJob(post({ url: bad }));
        expect(response.status).toBe(400);
        expect(apify.readPage).not.toHaveBeenCalled();
        expect(ai.extractJob).not.toHaveBeenCalled();
      },
    );

    it("shows our own message when the page cannot be read, and 503 when links are not set up", async () => {
      apify.readPage.mockRejectedValueOnce(new JobPageError("Reading the page took too long. Paste the text of the posting instead.", "timeout"));
      const slow = await readJob(post({ url: link }));
      expect(slow.status).toBe(502);
      expect((await slow.json()).error).toContain("took too long");

      apify.readPage.mockRejectedValueOnce(new JobPageError("Reading a link is not set up yet. Paste the text of the posting instead.", "not-configured"));
      const notSetUp = await readJob(post({ url: link }));
      expect(notSetUp.status).toBe(503);
      expect((await notSetUp.json()).error).toContain("not set up yet");
    });

    it("hides raw errors from Apify or the model", async () => {
      apify.readPage.mockRejectedValue(new Error("401 apify_api_SECRET"));
      const response = await readJob(post({ url: link }));
      expect(response.status).toBe(502);
      const text = JSON.stringify(await response.json());
      expect(text).toContain("Could not read that page");
      expect(text).not.toContain("SECRET");
    });
  });
});
