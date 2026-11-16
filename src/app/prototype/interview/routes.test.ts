import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const ai = vi.hoisted(() => {
  class AiError extends Error {}
  return { AiError, planInterview: vi.fn(), streamInterviewerTurn: vi.fn(), interviewFeedback: vi.fn() };
});
vi.mock("@/lib/ai", () => ai);

// The token call is mocked; the choice of voice runs for real.
const deepgram = vi.hoisted(() => ({ mintBrowserToken: vi.fn() }));
vi.mock("@/features/interview-prototype/deepgram", async (importActual) => ({
  ...(await importActual<typeof import("@/features/interview-prototype/deepgram")>()),
  mintBrowserToken: deepgram.mintBrowserToken,
}));

import { applyMove, startState } from "@/features/interview-prototype/state";
import type { Plan } from "@/features/interview-prototype/schemas";

import { POST as feedback } from "./feedback/route";
import { POST as session } from "./session/route";
import { POST as turn } from "./turn/route";

const plan: Plan = {
  language: "en",
  roleTitle: "Backend Engineer",
  companyName: null,
  questions: [
    { topic: "Background", question: "Walk me through your background.", lookFor: "Relevant experience." },
    { topic: "APIs", question: "How do you design a public API?", lookFor: "Versioning and errors." },
    { topic: "Conflict", question: "Tell me about a disagreement.", lookFor: "Their own role." },
  ],
};
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
    for (const route of [session, turn, feedback]) expect((await route(post({}))).status).toBe(404);
    expect(ai.planInterview).not.toHaveBeenCalled();
    expect(ai.streamInterviewerTurn).not.toHaveBeenCalled();
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
      ai.planInterview.mockResolvedValue({ plan, usage });
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

    it("uses the voice chosen on the form: Cliff by default, Sienna when picked, both at 0.9x with expressivity 1", async () => {
      ai.planInterview.mockResolvedValue({ plan, usage });
      deepgram.mintBrowserToken.mockResolvedValue("t");
      const speakUrl = async (extra: object) => new URL((await (await session(post({ jobDescription, durationMinutes: 10, ...extra }))).json()).deepgram.speakUrl);

      const byDefault = await speakUrl({});
      expect([byDefault.searchParams.get("model"), byDefault.searchParams.get("speed"), byDefault.searchParams.get("expressivity")]).toEqual(["flux-cliff-en", "0.9", "1"]);

      const sienna = await speakUrl({ voice: "sienna" });
      expect([sienna.searchParams.get("model"), sienna.searchParams.get("speed"), sienna.searchParams.get("expressivity")]).toEqual(["flux-sienna-en", "0.9", "1"]);
    });

    it("opens the interview in its own language with the chosen voice's native counterpart, at the same speed and expressivity", async () => {
      deepgram.mintBrowserToken.mockResolvedValue("t");
      const speakUrl = async (language: Plan["language"], voice: string) => {
        ai.planInterview.mockResolvedValue({ plan: { ...plan, language }, usage });
        return new URL((await (await session(post({ jobDescription, durationMinutes: 10, voice }))).json()).deepgram.speakUrl);
      };

      const cases = [
        ["pt", "cliff", "flux-bruno-pt"],
        ["pt", "sienna", "flux-mariana-pt"],
        ["es", "cliff", "flux-eduardo-es"],
        ["es", "sienna", "flux-carmen-es"],
        ["ja", "sienna", "flux-ayumi-ja"],
      ] as const;
      for (const [language, voice, model] of cases) {
        const url = await speakUrl(language, voice);
        expect([url.searchParams.get("model"), url.searchParams.get("speed"), url.searchParams.get("expressivity")], `${language} ${voice}`).toEqual([model, "0.9", "1"]);
      }
    });

    it("does not tell the speech recognizer which language to expect", async () => {
      ai.planInterview.mockResolvedValue({ plan: { ...plan, language: "es" }, usage });
      deepgram.mintBrowserToken.mockResolvedValue("t");
      const body = await (await session(post({ jobDescription, durationMinutes: 10 }))).json();
      expect(new URL(body.deepgram.listenUrl).searchParams.has("language_hint")).toBe(false);
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
});
