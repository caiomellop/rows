import { afterEach, describe, expect, it, vi } from "vitest";

import type { Player } from "./audio";
import { InterviewController, readEvents, type Deps, type StartForm } from "./controller";
import type { Segment } from "./heard";
import type { InterviewState, Plan, TurnEvent } from "./schemas";
import type { SttHandlers, SttTurn, TtsConnection, TtsHandlers } from "./sockets";

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
const form: StartForm = { jobDescription: "We are hiring a backend engineer to build payment APIs in Go.", resume: "", durationMinutes: 15 };
const usage = { input: 1000, output: 30, cacheRead: 800, cacheWrite: 0 };
const report = { summary: "Solid.", scores: [], strengths: ["clear"], improvements: ["add numbers"] };
const encoder = new TextEncoder();

class FakePlayer implements Player {
  calls: string[] = [];
  frames: ArrayBuffer[] = [];
  played = 0;
  audibleAt = 0;
  private first = true;
  begin() {
    this.calls.push("begin");
    this.first = true;
  }
  enqueue(frame: ArrayBuffer) {
    this.frames.push(frame);
    if (!this.first) return null;
    this.first = false;
    return { audibleAt: this.audibleAt };
  }
  playedMs() {
    return this.played;
  }
  stop() {
    this.calls.push("stop");
  }
  whenDrained() {
    return Promise.resolve();
  }
  close() {
    this.calls.push("close");
  }
}

class FakeTts implements TtsConnection {
  spoken: string[] = [];
  aborted = false;
  closed = false;
  audio: Segment[] = [];
  speak(text: string) {
    this.spoken.push(text);
  }
  finish() {
    return Promise.resolve();
  }
  abort() {
    this.aborted = true;
  }
  close() {
    this.closed = true;
  }
  segments() {
    return this.audio;
  }
}

type TurnRequest = { body: { state: InterviewState; plan: Plan }; signal: AbortSignal; send(event: TurnEvent): void; end(): void };

function harness(options: { budgetMs?: number } = {}) {
  const clock = { t: 0 };
  const player = new FakePlayer();
  const mic = { stop: vi.fn() };
  const stt = { send: vi.fn(), close: vi.fn(), secondsSent: 42.5, streamStartedAt: 1000 };
  const handlers: { stt?: SttHandlers } = {};
  const voices: { tts: FakeTts; handlers: TtsHandlers }[] = [];
  const turns: TurnRequest[] = [];
  const replies = { session: { status: 200, body: {} as unknown } };
  replies.session.body = { plan, budgetMs: options.budgetMs ?? 15 * 60_000, usage, deepgram: { token: "t", listenUrl: "wss://listen", speakUrl: "wss://speak" } };

  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/session")) return json(replies.session.body, replies.session.status);
    if (url.endsWith("/feedback")) return json({ feedback: report, usage: { input: 5000, output: 900, cacheRead: 0, cacheWrite: 0 } });
    let stream!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({ start: (c) => void (stream = c) });
    const signal = init?.signal as AbortSignal;
    signal.addEventListener("abort", () => {
      try {
        stream.error(new DOMException("Aborted", "AbortError"));
      } catch {
        // already closed
      }
    });
    turns.push({
      body: JSON.parse(init?.body as string),
      signal,
      send: (event) => stream.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)),
      end: () => stream.close(),
    });
    return new Response(body, { status: 200 });
  });

  const deps: Deps = {
    startMic: vi.fn(async () => mic),
    createPlayer: () => player,
    connectStt: vi.fn(async (_url: string, _token: string, h: SttHandlers) => {
      handlers.stt = h;
      return stt;
    }),
    connectTts: vi.fn(async (_url: string, _token: string, h: TtsHandlers) => {
      const tts = new FakeTts();
      voices.push({ tts, handlers: h });
      return tts;
    }),
    fetch: fetchMock as unknown as typeof fetch,
    now: () => clock.t,
  };
  const controller = new InterviewController(() => {}, deps);
  return { controller, clock, player, mic, stt, handlers, voices, turns, replies, fetchMock, deps, view: () => controller.getView() };
}
type Harness = ReturnType<typeof harness>;

const candidate = (transcript: string, extra: Partial<SttTurn> = {}): SttTurn => ({ kind: "turn", event: "EndOfTurn", transcript, lastWordEndSec: 5, languages: ["en"], receivedAt: 6320, ...extra });

/** Starts the interview and plays the opening message to the end. */
async function openInterview(h: Harness) {
  await h.controller.start(form);
  await vi.waitFor(() => expect(h.turns).toHaveLength(1));
  const request = h.turns[0];
  request.send({ t: "move", move: "NEXT" });
  request.send({ t: "text", text: "Welcome to the interview. Walk me through your background." });
  request.send({ t: "done", usage });
  request.end();
  await vi.waitFor(() => expect(h.view().turns).toHaveLength(1));
  return request;
}

afterEach(() => vi.useRealTimers());

describe("starting", () => {
  it("opens the microphone and the player, plans the interview, connects speech recognition and asks for the opening", async () => {
    const h = harness();
    await h.controller.start(form);
    await vi.waitFor(() => expect(h.turns).toHaveLength(1));

    expect(h.view()).toMatchObject({ phase: "live", status: "thinking", language: "en", budgetMs: 15 * 60_000 });
    expect(h.deps.connectStt).toHaveBeenCalledWith("wss://listen", "t", expect.any(Object));
    expect(h.turns[0].body.state).toMatchObject({ stage: "opening", transcript: [] });
    expect(h.view().usage.llm.input).toBe(1000); // the plan's usage is counted
  });

  it("feeds microphone frames to speech recognition once it is connected", async () => {
    const h = harness();
    const frames: ((pcm: ArrayBuffer) => void)[] = [];
    h.deps.startMic = vi.fn(async (onFrame) => {
      frames.push(onFrame);
      return h.mic;
    });
    frames.length = 0;
    await h.controller.start(form);
    const frame = new ArrayBuffer(2560);
    frames[0](frame);
    expect(h.stt.send).toHaveBeenCalledWith(frame);
  });

  it("says why when the microphone is blocked, and goes back to the form", async () => {
    const h = harness();
    h.deps.startMic = vi.fn(async () => {
      throw new DOMException("denied", "NotAllowedError");
    });
    await h.controller.start(form);
    expect(h.view().phase).toBe("setup");
    expect(h.view().error).toContain("Microphone access was blocked");
    expect(h.player.calls).toContain("close");
    expect(h.fetchMock).not.toHaveBeenCalled();
  });

  it("shows the server's own message when the session cannot start", async () => {
    const h = harness();
    h.replies.session = { status: 502, body: { error: "This Deepgram key cannot create temporary tokens. Use a key with the Member role." } };
    await h.controller.start(form);
    expect(h.view()).toMatchObject({ phase: "setup", error: "This Deepgram key cannot create temporary tokens. Use a key with the Member role." });
    expect(h.mic.stop).toHaveBeenCalled();
  });
});

describe("the opening", () => {
  it("speaks the opening piece by piece, then moves the interview to its first question", async () => {
    const h = harness();
    h.clock.t = 100;
    await h.controller.start(form);
    await vi.waitFor(() => expect(h.turns).toHaveLength(1));
    const request = h.turns[0];
    request.send({ t: "move", move: "NEXT" });
    request.send({ t: "text", text: "Welcome to the interview. Walk me through your background." });
    request.send({ t: "done", usage });
    request.end();

    await vi.waitFor(() => expect(h.view().turns).toHaveLength(1));
    expect(h.voices[0].tts.spoken).toEqual(["Welcome to the interview.", "Walk me through your background."]);
    expect(h.voices[0].tts.closed).toBe(true);
    expect(h.view().turns[0]).toMatchObject({ role: "interviewer", text: "Welcome to the interview. Walk me through your background." });
    expect(h.view().status).toBe("listening");
  });

  it("measures how long the opening took to be heard", async () => {
    const h = harness();
    h.clock.t = 500;
    await h.controller.start(form);
    await vi.waitFor(() => expect(h.voices).toHaveLength(1));
    h.player.audibleAt = 2300;
    h.voices[0].handlers.onAudio(new ArrayBuffer(4800));
    expect(h.view()).toMatchObject({ status: "speaking", startupMs: 1800 });
  });
});

describe("answering the candidate", () => {
  it("sends the candidate's words and the state, and measures the delay from the last word to the first audio", async () => {
    const h = harness();
    await openInterview(h);

    // Audio second 5 is wall time 6000 (the stream started at 1000). The end of the turn arrived at 6320.
    h.handlers.stt!.onTurn(candidate("Um, I have, uh, five years of backend experience."));
    await vi.waitFor(() => expect(h.turns).toHaveLength(2));
    const request = h.turns[1];
    expect(request.body.state).toMatchObject({ stage: "questions", questionIndex: 0, followUps: 0 });
    expect(request.body.state.transcript.map((t) => t.role)).toEqual(["interviewer", "candidate"]);
    expect(request.body.state.transcript[1].text).toBe("Um, I have, uh, five years of backend experience."); // fillers are kept

    h.clock.t = 6850;
    request.send({ t: "move", move: "FOLLOW_UP" });
    request.send({ t: "text", text: "Thanks for that. Which part of the stack did you own?" });
    await vi.waitFor(() => expect(h.voices[1].tts.spoken).toEqual(["Thanks for that."]));

    h.player.audibleAt = 7100;
    h.voices[1].handlers.onAudio(new ArrayBuffer(4800));
    expect(h.view().latencies).toEqual([{ turn: 1, detectMs: 320, modelMs: 530, sentenceMs: 0, voiceMs: 250, totalMs: 1100 }]);
    expect(h.view().status).toBe("speaking");
  });

  it("counts a follow-up only after the candidate heard it to the end", async () => {
    const h = harness();
    await openInterview(h);
    h.handlers.stt!.onTurn(candidate("I worked on payments."));
    await vi.waitFor(() => expect(h.turns).toHaveLength(2));
    h.turns[1].send({ t: "move", move: "FOLLOW_UP" });
    h.turns[1].send({ t: "text", text: "What was your own role in that?" });
    h.turns[1].end();
    await vi.waitFor(() => expect(h.view().turns).toHaveLength(3));

    h.handlers.stt!.onTurn(candidate("I led the ledger service."));
    await vi.waitFor(() => expect(h.turns).toHaveLength(3));
    expect(h.turns[2].body.state).toMatchObject({ questionIndex: 0, followUps: 1 });
  });

  it("ignores empty turns", async () => {
    const h = harness();
    await openInterview(h);
    h.handlers.stt!.onTurn(candidate("   "));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(h.turns).toHaveLength(1);
  });
});

describe("interruptions", () => {
  async function speakingFollowUp(h: Harness) {
    await openInterview(h);
    h.handlers.stt!.onTurn(candidate("I worked on payments."));
    await vi.waitFor(() => expect(h.turns).toHaveLength(2));
    const request = h.turns[1];
    request.send({ t: "move", move: "FOLLOW_UP" });
    request.send({ t: "text", text: "Thanks for that. Which part of the stack did you own?" });
    await vi.waitFor(() => expect(h.voices[1].tts.spoken).toHaveLength(1));
    h.voices[1].handlers.onAudio(new ArrayBuffer(4800));
    return request;
  }

  it("stops the model, the voice and the sound at once, and keeps only what was heard", async () => {
    const h = harness();
    const request = await speakingFollowUp(h);
    // 1.5 s were heard: all of "Thanks for that." (1 s) and a quarter of the second sentence.
    h.voices[1].tts.audio = [
      { text: "Thanks for that.", audioMs: 1000 },
      { text: "Which part of the stack did you own?", audioMs: 2000 },
    ];
    h.player.played = 1500;

    h.handlers.stt!.onTurn({ ...candidate("Actually, wait"), event: "Update" });

    expect(request.signal.aborted).toBe(true);
    expect(h.voices[1].tts.aborted).toBe(true);
    expect(h.player.calls).toContain("stop");
    expect(h.view().status).toBe("listening");
    const last = h.view().turns.at(-1);
    expect(last).toMatchObject({ role: "interviewer", text: "Thanks for that. Which part", interrupted: true });
  });

  it("does not count the cut-off turn as asked: the follow-up counter and the question stay as they were", async () => {
    const h = harness();
    await speakingFollowUp(h);
    h.voices[1].tts.audio = [{ text: "Thanks for that.", audioMs: 1000 }];
    h.player.played = 500;
    h.handlers.stt!.onTurn({ ...candidate("Sorry, one thing"), event: "StartOfTurn" });
    h.handlers.stt!.onTurn(candidate("Sorry, one thing I forgot to say."));

    await vi.waitFor(() => expect(h.turns).toHaveLength(3));
    const { state } = h.turns[2].body;
    expect(state).toMatchObject({ questionIndex: 0, followUps: 0 });
    expect(state.transcript.map((t) => [t.role, t.interrupted ?? false])).toEqual([
      ["interviewer", false],
      ["candidate", false],
      ["interviewer", true],
      ["candidate", false],
    ]);
  });

  it("drops a reply that was still being written when the candidate went on talking", async () => {
    const h = harness();
    await openInterview(h);
    h.handlers.stt!.onTurn(candidate("I worked on payments."));
    await vi.waitFor(() => expect(h.turns).toHaveLength(2));

    // No audio has played, so nothing was heard.
    h.handlers.stt!.onTurn({ ...candidate("and also on billing"), event: "Update" });
    expect(h.turns[1].signal.aborted).toBe(true);
    expect(h.view().turns.map((t) => t.role)).toEqual(["interviewer", "candidate"]);

    h.handlers.stt!.onTurn(candidate("and also on billing, for two years."));
    await vi.waitFor(() => expect(h.turns).toHaveLength(3));
    expect(h.turns[2].body.state.transcript.map((t) => t.role)).toEqual(["interviewer", "candidate", "candidate"]);
  });

  it("does not treat a tiny sound as talking over the interviewer", async () => {
    const h = harness();
    const request = await speakingFollowUp(h);
    h.handlers.stt!.onTurn({ ...candidate("a"), event: "Update" });
    expect(request.signal.aborted).toBe(false);
    expect(h.voices[1].tts.aborted).toBe(false);
  });
});

describe("ending", () => {
  it("closes everything, asks for the feedback with the whole transcript, and adds up the usage", async () => {
    const h = harness();
    await openInterview(h);
    h.handlers.stt!.onTurn(candidate("I have five years of experience."));
    await vi.waitFor(() => expect(h.turns).toHaveLength(2));
    h.clock.t = 62_000;

    h.controller.end();
    await vi.waitFor(() => expect(h.view().feedback.state).toBe("ready"));

    expect(h.view().phase).toBe("done");
    expect(h.mic.stop).toHaveBeenCalled();
    expect(h.stt.close).toHaveBeenCalled();
    expect(h.view().usage.sttSeconds).toBe(42.5);
    expect(h.view().usage.feedback.input).toBe(5000);
    expect(h.view().usage.ttsChars).toBeGreaterThan(0);
    const call = h.fetchMock.mock.calls.find(([url]) => String(url).endsWith("/feedback"));
    const sent = JSON.parse((call?.[1] as RequestInit).body as string);
    expect(sent.transcript.map((t: { role: string }) => t.role)).toEqual(["interviewer", "candidate"]);
  });

  it("does not ask for feedback when the candidate never answered", async () => {
    const h = harness();
    await openInterview(h);
    h.controller.end();
    await vi.waitFor(() => expect(h.view().phase).toBe("done"));
    expect(h.view().feedback).toMatchObject({ state: "failed", error: "There were no answers to review." });
    expect(h.fetchMock.mock.calls.some(([url]) => String(url).endsWith("/feedback"))).toBe(false);
  });

  it("closes the interview when the interviewer ends it, after the goodbye was heard", async () => {
    const h = harness({ budgetMs: 120_000 });
    await openInterview(h);
    // 40 s of 120 s are left: time to close.
    h.clock.t = 80_000;
    h.handlers.stt!.onTurn(candidate("That is all from me."));
    await vi.waitFor(() => expect(h.turns).toHaveLength(2));
    expect(h.turns[1].body.state.stage).toBe("closing");

    h.turns[1].send({ t: "move", move: "END" });
    h.turns[1].send({ t: "text", text: "Thank you, that was very helpful. Goodbye." });
    h.turns[1].end();
    await vi.waitFor(() => expect(h.view().phase).toBe("done"));
    expect(h.view().turns.at(-1)).toMatchObject({ role: "interviewer", text: "Thank you, that was very helpful. Goodbye." });
    await vi.waitFor(() => expect(h.view().feedback.state).toBe("ready"));
  });

  it("ends the interview with what it has when speech recognition fails", async () => {
    const h = harness();
    await openInterview(h);
    h.handlers.stt!.onError("Speech recognition failed (INTERNAL_SERVER_ERROR).");
    await vi.waitFor(() => expect(h.view().phase).toBe("done"));
    expect(h.view().error).toBe("Speech recognition failed (INTERNAL_SERVER_ERROR).");
    expect(h.view().turns).toHaveLength(1);
  });

  it("lets the interviewer close by itself when the time is over and the candidate is quiet", async () => {
    vi.useFakeTimers();
    const h = harness({ budgetMs: 60_000 });
    await h.controller.start(form);
    await vi.advanceTimersByTimeAsync(0);
    h.turns[0].send({ t: "move", move: "NEXT" });
    h.turns[0].send({ t: "text", text: "Welcome to the interview. Walk me through your background." });
    h.turns[0].end();
    await vi.advanceTimersByTimeAsync(0);
    expect(h.view().turns).toHaveLength(1);

    h.clock.t = 60_000 + 31_000;
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.turns).toHaveLength(2);
    expect(h.turns[1].body.state.stage).toBe("closing");
  });
});

describe("the turn stream", () => {
  const streamOf = (text: string, chunk: number) =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        const bytes = encoder.encode(text);
        for (let i = 0; i < bytes.length; i += chunk) controller.enqueue(bytes.slice(i, i + chunk));
        controller.close();
      },
    });

  it("reads one event per line, even when a line is split across network pieces", async () => {
    const lines = [{ t: "move", move: "NEXT" }, { t: "text", text: "Olá, tudo bem?" }, { t: "done", usage }].map((e) => JSON.stringify(e)).join("\n");
    const events: TurnEvent[] = [];
    for await (const event of readEvents(streamOf(`${lines}\n`, 7))) events.push(event);
    expect(events.map((e) => e.t)).toEqual(["move", "text", "done"]);
    expect(events[1]).toEqual({ t: "text", text: "Olá, tudo bem?" });
  });

  it("skips lines it cannot read", async () => {
    const events: TurnEvent[] = [];
    for await (const event of readEvents(streamOf(`garbage\n{"t":"nope"}\n${JSON.stringify({ t: "text", text: "ok" })}`, 5))) events.push(event);
    expect(events).toEqual([{ t: "text", text: "ok" }]);
  });
});
