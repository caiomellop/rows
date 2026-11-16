import { STT_SAMPLE_RATE, TTS_SAMPLE_RATE } from "./deepgram-urls";
import { parseSttMessage, parseTtsMessage, type SttMessage } from "./flux-messages";
import type { Segment } from "./heard";

/**
 * The two browser WebSockets to Deepgram, opened with the short-lived token the server minted.
 * Browsers cannot set headers on a WebSocket, so the token goes in the subprotocol list:
 * ["bearer", token] (an API key would be ["token", key], and never reaches the browser).
 */

const OPEN = 1;
/** The microphone sends 80 ms frames. */
const FRAME_MS = 80;
/** How long a finished message waits for the voice's last "Flushed" before moving on. */
const FINISH_TIMEOUT_MS = 4000;

export type OpenSocket = (url: string, protocols: string[]) => WebSocket;
const defaultOpen: OpenSocket = (url, protocols) => new WebSocket(url, protocols);

/* ------------------------------------------------------------------ */
/* Speech recognition: one socket for the whole interview              */
/* ------------------------------------------------------------------ */

export type SttTurn = Extract<SttMessage, { kind: "turn" }> & { /** performance.now() when the message arrived. */ receivedAt: number };

export type SttHandlers = { onTurn: (turn: SttTurn) => void; onError: (message: string) => void; onClose: () => void };

export type SttConnection = {
  /** Sends one frame of 16 kHz, 16-bit, mono audio. */
  send(frame: ArrayBuffer): void;
  close(): void;
  /** Seconds of audio sent so far (what speech recognition bills). */
  readonly secondsSent: number;
  /** performance.now() when the audio timeline started: audio second 0. */
  readonly streamStartedAt: number | null;
};

export function connectStt(url: string, token: string, handlers: SttHandlers, open: OpenSocket = defaultOpen): Promise<SttConnection> {
  return new Promise((resolve, reject) => {
    const socket = open(url, ["bearer", token]);
    socket.binaryType = "arraybuffer";
    let opened = false;
    let secondsSent = 0;
    let startedAt: number | null = null;

    const connection: SttConnection = {
      send(frame) {
        if (socket.readyState !== OPEN) return;
        // The first frame was captured one frame ago: that is audio second 0.
        if (startedAt === null) startedAt = performance.now() - FRAME_MS;
        socket.send(frame);
        secondsSent += frame.byteLength / (2 * STT_SAMPLE_RATE);
      },
      close() {
        if (socket.readyState === OPEN) socket.send(JSON.stringify({ type: "CloseStream" }));
        socket.close();
      },
      get secondsSent() {
        return secondsSent;
      },
      get streamStartedAt() {
        return startedAt;
      },
    };

    socket.onopen = () => {
      opened = true;
      resolve(connection);
    };
    socket.onerror = () => {
      if (opened) handlers.onError("The speech recognition connection failed.");
      else reject(new Error("Could not connect to speech recognition."));
    };
    socket.onclose = () => {
      if (opened) handlers.onClose();
      else reject(new Error("Could not connect to speech recognition."));
    };
    socket.onmessage = (event) => {
      if (typeof event.data !== "string") return;
      const message = parseSttMessage(event.data);
      if (message.kind === "turn") handlers.onTurn({ ...message, receivedAt: performance.now() });
      else if (message.kind === "error") handlers.onError(message.message);
    };
  });
}

/* ------------------------------------------------------------------ */
/* Voice: one socket per interviewer message                           */
/* ------------------------------------------------------------------ */

export type TtsHandlers = { onAudio: (pcm: ArrayBuffer) => void; onError: (message: string) => void };

export type TtsConnection = {
  /** Sends a piece of text and asks the voice to speak it now (Speak + Flush). */
  speak(text: string): void;
  /** Resolves when every piece sent so far has been generated. */
  finish(): Promise<void>;
  /** Stops the voice right away: the candidate interrupted. */
  abort(): void;
  /** Closes the socket after a message that was spoken to the end. */
  close(): void;
  /** The pieces sent, each with the length of audio received for it. */
  segments(): Segment[];
};

export function connectTts(url: string, token: string, handlers: TtsHandlers, open: OpenSocket = defaultOpen): Promise<TtsConnection> {
  return new Promise((resolve, reject) => {
    const socket = open(url, ["bearer", token]);
    socket.binaryType = "arraybuffer";
    let opened = false;
    let ended = false;
    const pieces: string[] = [];
    const audioBytes: number[] = [];
    let started = -1;
    let flushed = 0;
    let waiters: (() => void)[] = [];

    const wake = () => {
      const ready = waiters;
      waiters = [];
      for (const resolveWaiter of ready) resolveWaiter();
    };

    const connection: TtsConnection = {
      speak(text) {
        if (ended || socket.readyState !== OPEN) return;
        pieces.push(text);
        socket.send(JSON.stringify({ type: "Speak", text }));
        socket.send(JSON.stringify({ type: "Flush" }));
      },
      finish() {
        return new Promise((done) => {
          // If Deepgram ever answers with fewer "Flushed" than pieces sent, do not wait for ever.
          const timer = setTimeout(done, FINISH_TIMEOUT_MS);
          const check = () => {
            if (ended || flushed >= pieces.length) {
              clearTimeout(timer);
              done();
            } else waiters.push(check);
          };
          check();
        });
      },
      abort() {
        ended = true;
        socket.close();
        wake();
      },
      close() {
        ended = true;
        if (socket.readyState === OPEN) socket.send(JSON.stringify({ type: "Close" }));
        socket.close();
        wake();
      },
      segments() {
        return pieces.map((text, i) => ({ text, audioMs: ((audioBytes[i] ?? 0) / (2 * TTS_SAMPLE_RATE)) * 1000 }));
      },
    };

    socket.onopen = () => {
      opened = true;
      resolve(connection);
    };
    socket.onerror = () => {
      if (!opened) reject(new Error("Could not connect to the voice."));
      else if (!ended) handlers.onError("The voice connection failed.");
    };
    socket.onclose = () => {
      ended = true;
      if (!opened) reject(new Error("Could not connect to the voice."));
      wake();
    };
    socket.onmessage = (event) => {
      if (typeof event.data !== "string") {
        // Audio belongs to the piece that started last: pieces are sent, and answered, in order.
        const frame = event.data as ArrayBuffer;
        if (started >= 0) audioBytes[started] = (audioBytes[started] ?? 0) + frame.byteLength;
        handlers.onAudio(frame);
        return;
      }
      const message = parseTtsMessage(event.data);
      if (message.kind === "speechStarted") started += 1;
      else if (message.kind === "flushed") {
        flushed += 1;
        wake();
      } else if (message.kind === "error") handlers.onError(message.message);
    };
  });
}
