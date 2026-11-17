import type { Mic, Player } from "./audio";
import { heardText } from "./heard";
import type { Language, VoiceId } from "./languages";
import { addLlmUsage, emptyUsage, latencyFromMarks, type LlmUsage, type TurnLatency, type Usage } from "./metrics";
import { SentenceChunker } from "./sentences";
import {
  FeedbackResponseSchema,
  SessionResponseSchema,
  TurnEventSchema,
  type Feedback,
  type Move,
  type Plan,
  type SessionResponse,
  type Turn,
  type TurnEvent,
} from "./schemas";
import type { connectStt, connectTts, SttConnection, SttTurn, TtsConnection } from "./sockets";
import { addTurn, allowedMoves, applyMove, coerceMove, OVERTIME_GRACE_MS, prepareTurn, startState } from "./state";

/**
 * The interview loop, in the browser: listen, decide the candidate has finished, think, speak, listen again.
 * Everything with side effects (microphone, sockets, player, fetch, clock) is injected, so the loop is
 * tested with fakes. Nothing is stored: the state lives here until the page is closed.
 */

const BASE = "/interview";
const JSON_HEADERS = { "Content-Type": "application/json" };
/** Words this long, heard while the interviewer is speaking, count as the candidate talking over it. */
const BARGE_IN_MIN_CHARS = 3;

/** What the interview is built from. `jobDescription` is the text of the posting, pasted or already read from a link. */
export type SessionForm = { jobDescription: string; resume: string; durationMinutes: 15 | 20 | 30; voice: VoiceId };
/** `readUsage` is what reading the link cost, so the cost of the whole interview adds up. It is not sent to the server. */
export type StartForm = SessionForm & { readUsage?: LlmUsage };

export type Phase = "setup" | "starting" | "live" | "done";
export type Status = "listening" | "thinking" | "speaking";
export type FeedbackState = { state: "idle" | "loading" | "ready" | "failed"; report?: Feedback; error?: string };

export type View = {
  phase: Phase;
  status: Status;
  turns: Turn[];
  /** What the candidate is saying right now. */
  partial: string;
  /** What the interviewer is saying right now. */
  speaking: string;
  elapsedMs: number;
  budgetMs: number;
  language: Language | null;
  /** The job the interview is for, as the planner understood it. */
  role: { title: string; company: string | null } | null;
  /** From the last word to the first audio, one entry per reply to the candidate. */
  latencies: TurnLatency[];
  /** From pressing the button to hearing the opening question. */
  startupMs: number | null;
  usage: Usage;
  feedback: FeedbackState;
  error: string | null;
};

export type Deps = {
  startMic: (onFrame: (pcm: ArrayBuffer) => void) => Promise<Mic>;
  createPlayer: () => Player;
  connectStt: typeof connectStt;
  connectTts: typeof connectTts;
  fetch: typeof fetch;
  /** performance.now(): one clock for every measurement. */
  now: () => number;
};

export const initialView = (): View => ({
  phase: "setup",
  status: "listening",
  turns: [],
  partial: "",
  speaking: "",
  elapsedMs: 0,
  budgetMs: 0,
  language: null,
  role: null,
  latencies: [],
  startupMs: null,
  usage: emptyUsage(),
  feedback: { state: "idle" },
  error: null,
});

/** One interviewer message in flight. */
type ActiveTurn = {
  abort: AbortController;
  tts: TtsConnection | null;
  chunker: SentenceChunker;
  text: string;
  move: Move | null;
  interrupted: boolean;
  opening: boolean;
  sentChars: number;
  /** Set when this message answers the candidate: the start of the latency measure. */
  answering: { lastWordAt: number; endOfTurnAt: number } | null;
  firstTokenAt: number | null;
  speakSentAt: number | null;
};

export class InterviewController {
  private view = initialView();
  private state = startState(60_000);
  private setup: { form: SessionForm; plan: Plan; deepgram: SessionResponse["deepgram"] } | null = null;
  private player: Player | null = null;
  private mic: Mic | null = null;
  private stt: SttConnection | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private current: ActiveTurn | null = null;
  private answering: ActiveTurn["answering"] = null;
  private usage = emptyUsage();
  private clickAt = 0;
  private startedAt = 0;
  private disposed = false;

  constructor(
    private readonly listener: (view: View) => void,
    private readonly deps: Deps,
  ) {}

  getView(): View {
    return this.view;
  }

  /** Call from the click that starts the interview: the browser only lets audio start from a gesture. */
  async start(form: StartForm): Promise<void> {
    if (this.view.phase !== "setup") return;
    this.clickAt = this.deps.now();
    this.set({ ...initialView(), phase: "starting" });
    // The link, if there was one, was read before the button was pressed. Its cost belongs to this interview.
    const { readUsage, ...request } = form;
    if (readUsage) this.usage = { ...this.usage, llm: addLlmUsage(this.usage.llm, readUsage) };
    try {
      this.player = this.deps.createPlayer();
      this.mic = await this.deps.startMic((frame) => this.stt?.send(frame));

      const response = await this.deps.fetch(`${BASE}/session`, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(request) });
      if (!response.ok) throw new Error(await errorFrom(response, "Could not start the interview."));
      const session = SessionResponseSchema.safeParse(await response.json().catch(() => null));
      if (!session.success) throw new Error("The server answered in an unexpected way.");

      const { plan, deepgram, budgetMs, usage } = session.data;
      this.setup = { form: request, plan, deepgram };
      this.state = startState(budgetMs);
      this.usage = { ...this.usage, llm: addLlmUsage(this.usage.llm, usage) };
      this.stt = await this.deps.connectStt(deepgram.listenUrl, deepgram.token, {
        onTurn: (turn) => this.onSttTurn(turn),
        onError: (message) => this.fail(message),
        onClose: () => this.fail("Speech recognition disconnected."),
      });

      this.startedAt = this.deps.now();
      this.timer = setInterval(() => this.tick(), 1000);
      this.set({ phase: "live", status: "thinking", language: plan.language, role: { title: plan.roleTitle, company: plan.companyName }, budgetMs, usage: this.usage });
      void this.interviewerTurn();
    } catch (error) {
      this.fail(messageOf(error));
    }
  }

  /** The candidate ends the interview from the page. */
  end(): void {
    void this.finish();
  }

  /** The feedback request failed or timed out: ask again. */
  retryFeedback(): void {
    if (this.view.phase === "done") void this.loadFeedback();
  }

  /** The page is closing: stop everything and stay quiet. */
  dispose(): void {
    this.disposed = true;
    this.current?.abort.abort();
    this.current?.tts?.abort();
    this.cleanup();
  }

  /* -------------------------------------------------------------- */
  /* Listening                                                        */
  /* -------------------------------------------------------------- */

  private onSttTurn(turn: SttTurn) {
    if (this.view.phase !== "live") return;
    if (turn.event === "EndOfTurn") {
      this.onCandidateTurn(turn);
    } else if (turn.event === "StartOfTurn" || turn.event === "Update" || turn.event === "TurnResumed") {
      this.set({ partial: turn.transcript });
      // The candidate talks over the interviewer: stop right away.
      if (turn.transcript.trim().length >= BARGE_IN_MIN_CHARS) this.interrupt();
    }
  }

  private onCandidateTurn(turn: SttTurn) {
    const text = turn.transcript.trim();
    if (!text) return;
    this.interrupt(); // does nothing unless the interviewer is still talking
    this.state = addTurn(this.state, { role: "candidate", text, at: this.seconds() });

    const streamStart = this.stt?.streamStartedAt ?? null;
    this.answering =
      turn.lastWordEndSec !== null && streamStart !== null ? { lastWordAt: streamStart + turn.lastWordEndSec * 1000, endOfTurnAt: turn.receivedAt } : null;

    this.set({ turns: this.state.transcript, partial: "" });
    void this.interviewerTurn();
  }

  /* -------------------------------------------------------------- */
  /* Thinking and speaking                                            */
  /* -------------------------------------------------------------- */

  private async interviewerTurn(): Promise<void> {
    const setup = this.setup;
    const player = this.player;
    if (!setup || !player || this.view.phase !== "live") return;
    if (this.current) this.interrupt();

    this.state = prepareTurn(this.state, setup.plan, this.deps.now() - this.startedAt);
    const turn: ActiveTurn = {
      abort: new AbortController(),
      tts: null,
      chunker: new SentenceChunker(),
      text: "",
      move: null,
      interrupted: false,
      opening: this.state.stage === "opening",
      sentChars: 0,
      answering: this.answering,
      firstTokenAt: null,
      speakSentAt: null,
    };
    this.answering = null;
    this.current = turn;
    player.begin();
    this.set({ status: "thinking", speaking: "" });

    // The voice socket opens while Claude thinks, so its handshake hides behind the model's first token.
    const voice = this.deps
      .connectTts(setup.deepgram.speakUrl, setup.deepgram.token, { onAudio: (frame) => this.onAudio(turn, frame), onError: (message) => this.fail(message) })
      .then((tts) => {
        turn.tts = tts;
        if (turn.interrupted) tts.abort();
        return tts;
      });
    voice.catch(() => {}); // the failure surfaces below, when the voice is awaited

    try {
      const body = JSON.stringify({ jobDescription: setup.form.jobDescription, resume: setup.form.resume, plan: setup.plan, state: this.state });
      const response = await this.deps.fetch(`${BASE}/turn`, { method: "POST", headers: JSON_HEADERS, body, signal: turn.abort.signal });
      if (!response.ok || !response.body) throw new Error(await errorFrom(response, "The interviewer could not answer."));
      const tts = await voice;

      for await (const event of readEvents(response.body)) {
        if (turn.interrupted) return;
        this.onTurnEvent(turn, tts, event);
      }
      if (turn.interrupted) return;
      for (const piece of turn.chunker.flush()) this.speak(turn, tts, piece);
      await tts.finish();
      if (turn.interrupted) return;
      await player.whenDrained();
      if (turn.interrupted) return;
      tts.close();
      this.completeTurn(turn);
    } catch (error) {
      if (!turn.interrupted) this.fail(messageOf(error));
    }
  }

  private onTurnEvent(turn: ActiveTurn, tts: TtsConnection, event: TurnEvent) {
    switch (event.t) {
      case "move":
        turn.move = event.move;
        break;
      case "text":
        turn.firstTokenAt ??= this.deps.now();
        turn.text += event.text;
        this.set({ speaking: turn.text });
        for (const piece of turn.chunker.push(event.text)) this.speak(turn, tts, piece);
        break;
      case "done":
        this.usage = { ...this.usage, llm: addLlmUsage(this.usage.llm, event.usage) };
        break;
      case "error":
        throw new Error(event.message);
    }
  }

  private speak(turn: ActiveTurn, tts: TtsConnection, piece: string) {
    turn.speakSentAt ??= this.deps.now();
    turn.sentChars += piece.length;
    tts.speak(piece);
  }

  private onAudio(turn: ActiveTurn, frame: ArrayBuffer) {
    if (this.current !== turn || turn.interrupted || !this.player) return;
    const heard = this.player.enqueue(frame);
    if (!heard) return; // not the first audio of the message
    this.set({ status: "speaking" });

    if (turn.opening) {
      this.set({ startupMs: Math.round(heard.audibleAt - this.clickAt) });
    } else if (turn.answering && turn.firstTokenAt !== null && turn.speakSentAt !== null) {
      const latency = latencyFromMarks(this.view.latencies.length + 1, { ...turn.answering, firstTokenAt: turn.firstTokenAt, speakSentAt: turn.speakSentAt, playAt: heard.audibleAt });
      this.set({ latencies: [...this.view.latencies, latency] });
    }
  }

  /** The candidate heard the whole message: now the interview moves on. */
  private completeTurn(turn: ActiveTurn) {
    const setup = this.setup;
    if (!setup) return;
    this.current = null;
    this.usage = { ...this.usage, ttsChars: this.usage.ttsChars + turn.sentChars };
    const text = turn.text.trim();
    if (text) this.state = addTurn(this.state, { role: "interviewer", text, at: this.seconds() });
    this.state = applyMove(this.state, coerceMove(turn.move, allowedMoves(this.state, setup.plan)), setup.plan);
    this.set({ turns: this.state.transcript, speaking: "", status: "listening", usage: this.usage });
    if (this.state.stage === "done") void this.finish();
  }

  /**
   * The candidate talked over the interviewer: stop the model, the voice and the sound at once, and
   * keep only what was actually heard. A cut-off message does not move the interview forward.
   */
  private interrupt() {
    const turn = this.current;
    const player = this.player;
    if (!turn || !player) return;
    turn.interrupted = true;
    this.current = null;
    turn.abort.abort();

    const heard = heardText(turn.tts?.segments() ?? [], player.playedMs());
    turn.tts?.abort();
    player.stop();

    this.usage = { ...this.usage, ttsChars: this.usage.ttsChars + turn.sentChars };
    if (heard) this.state = addTurn(this.state, { role: "interviewer", text: heard, at: this.seconds(), interrupted: true });
    this.set({ turns: this.state.transcript, speaking: "", status: "listening", usage: this.usage });
  }

  /* -------------------------------------------------------------- */
  /* Clock, end and feedback                                          */
  /* -------------------------------------------------------------- */

  private tick() {
    const elapsedMs = this.deps.now() - this.startedAt;
    this.set({ elapsedMs });
    const overtime = elapsedMs > this.state.budgetMs + OVERTIME_GRACE_MS;
    // Out of time and the candidate is quiet: the interviewer closes by itself.
    if (overtime && this.view.status === "listening" && !this.current && !this.view.partial && this.state.stage !== "done") void this.interviewerTurn();
  }

  private async finish(): Promise<void> {
    if (this.view.phase !== "live") return;
    this.interrupt();
    const elapsedMs = this.deps.now() - this.startedAt;
    this.usage = { ...this.usage, sttSeconds: this.stt?.secondsSent ?? 0 };
    this.cleanup();

    const answered = this.state.transcript.some((turn) => turn.role === "candidate");
    this.set({
      phase: "done",
      status: "listening",
      partial: "",
      speaking: "",
      elapsedMs,
      turns: this.state.transcript,
      usage: this.usage,
      feedback: answered ? { state: "loading" } : { state: "failed", error: "There were no answers to review." },
    });
    if (answered) await this.loadFeedback();
  }

  private async loadFeedback(): Promise<void> {
    const setup = this.setup;
    if (!setup) return;
    this.set({ feedback: { state: "loading" } });
    try {
      const response = await this.deps.fetch(`${BASE}/feedback`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ jobDescription: setup.form.jobDescription, plan: setup.plan, transcript: this.state.transcript }),
      });
      if (!response.ok) throw new Error(await errorFrom(response, "Could not write the feedback."));
      const parsed = FeedbackResponseSchema.safeParse(await response.json().catch(() => null));
      if (!parsed.success) throw new Error("The server answered in an unexpected way.");
      this.usage = { ...this.usage, feedback: addLlmUsage(this.usage.feedback, parsed.data.usage) };
      this.set({ usage: this.usage, feedback: { state: "ready", report: parsed.data.feedback } });
    } catch (error) {
      this.set({ feedback: { state: "failed", error: messageOf(error) } });
    }
  }

  private fail(message: string) {
    if (this.view.phase === "starting") {
      this.cleanup();
      this.set({ phase: "setup", status: "listening", error: message });
    } else if (this.view.phase === "live") {
      this.set({ error: message });
      void this.finish();
    }
  }

  private cleanup() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.mic?.stop();
    this.stt?.close();
    this.player?.close();
    this.mic = null;
    this.stt = null;
    this.player = null;
  }

  private seconds(): number {
    return (this.deps.now() - this.startedAt) / 1000;
  }

  private set(patch: Partial<View>) {
    if (this.disposed) return;
    this.view = { ...this.view, ...patch };
    this.listener(this.view);
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** One TurnEvent per line of the turn route's response. */
export async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<TurnEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const parse = (line: string): TurnEvent | null => {
    try {
      const event = TurnEventSchema.safeParse(JSON.parse(line));
      return event.success ? event.data : null;
    } catch {
      return null;
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: !done });
    for (let newline = buffer.indexOf("\n"); newline !== -1; newline = buffer.indexOf("\n")) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      const event = line ? parse(line) : null;
      if (event) yield event;
    }
    if (done) break;
  }
  const rest = buffer.trim() ? parse(buffer.trim()) : null;
  if (rest) yield rest;
}

async function errorFrom(response: Response, fallback: string): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  const message = typeof body === "object" && body !== null && "error" in body ? (body as { error: unknown }).error : null;
  return typeof message === "string" ? message : fallback;
}

export function messageOf(error: unknown): string {
  if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError")) {
    return "Microphone access was blocked. Allow it in the browser and try again.";
  }
  if (error instanceof DOMException && error.name === "NotFoundError") return "No microphone was found.";
  return error instanceof Error && error.message ? error.message : "Something went wrong. Try again.";
}
