import { describe, expect, it, vi } from "vitest";

import { connectStt, connectTts, type OpenSocket } from "./sockets";

/** Just enough of a WebSocket for the wrappers. The test plays the part of the server. */
class FakeSocket {
  readyState = 0;
  binaryType = "blob";
  sent: (string | ArrayBuffer)[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  constructor(
    readonly url: string,
    readonly protocols: string[],
  ) {}
  send(data: string | ArrayBuffer) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  receive(data: unknown) {
    this.onmessage?.({ data });
  }
  json(message: Record<string, unknown>) {
    this.receive(JSON.stringify(message));
  }
  get sentJson() {
    return this.sent.filter((s): s is string => typeof s === "string").map((s) => JSON.parse(s));
  }
}

function fakeOpen() {
  const sockets: FakeSocket[] = [];
  const open: OpenSocket = (url, protocols) => {
    const socket = new FakeSocket(url, protocols);
    sockets.push(socket);
    return socket as unknown as WebSocket;
  };
  return { open, sockets };
}

const frame = (bytes: number) => new ArrayBuffer(bytes);

describe("speech recognition socket", () => {
  it("authenticates with the token in the subprotocols and resolves once open", async () => {
    const { open, sockets } = fakeOpen();
    const pending = connectStt("wss://stt", "browser-token", { onTurn: vi.fn(), onError: vi.fn(), onClose: vi.fn() }, open);
    expect(sockets[0].protocols).toEqual(["bearer", "browser-token"]);
    expect(sockets[0].binaryType).toBe("arraybuffer");
    sockets[0].open();
    await expect(pending).resolves.toBeDefined();
  });

  it("counts the audio it sends and marks when the audio timeline started", async () => {
    const { open, sockets } = fakeOpen();
    const pending = connectStt("wss://stt", "t", { onTurn: vi.fn(), onError: vi.fn(), onClose: vi.fn() }, open);
    sockets[0].open();
    const stt = await pending;
    expect(stt.streamStartedAt).toBeNull();

    stt.send(frame(2560)); // 80 ms of 16 kHz, 16-bit mono
    stt.send(frame(2560));
    expect(stt.secondsSent).toBeCloseTo(0.16, 5);
    expect(stt.streamStartedAt).not.toBeNull();
    expect(sockets[0].sent).toHaveLength(2);
  });

  it("passes turns on, with the time they arrived, and reports errors", async () => {
    const { open, sockets } = fakeOpen();
    const handlers = { onTurn: vi.fn(), onError: vi.fn(), onClose: vi.fn() };
    const pending = connectStt("wss://stt", "t", handlers, open);
    sockets[0].open();
    await pending;

    sockets[0].json({ type: "TurnInfo", event: "EndOfTurn", transcript: "hello there", words: [{ word: "hello", end: 0.4 }, { word: "there", end: 0.9 }] });
    expect(handlers.onTurn).toHaveBeenCalledWith(expect.objectContaining({ event: "EndOfTurn", transcript: "hello there", lastWordEndSec: 0.9, receivedAt: expect.any(Number) }));

    sockets[0].json({ type: "Error", code: "X" });
    expect(handlers.onError).toHaveBeenCalledWith("Speech recognition failed (X).");
  });

  it("fails to connect when the socket closes before opening", async () => {
    const { open, sockets } = fakeOpen();
    const pending = connectStt("wss://stt", "t", { onTurn: vi.fn(), onError: vi.fn(), onClose: vi.fn() }, open);
    sockets[0].close();
    await expect(pending).rejects.toThrow("Could not connect to speech recognition");
  });

  it("tells the server the stream is over when closed", async () => {
    const { open, sockets } = fakeOpen();
    const pending = connectStt("wss://stt", "t", { onTurn: vi.fn(), onError: vi.fn(), onClose: vi.fn() }, open);
    sockets[0].open();
    (await pending).close();
    expect(sockets[0].sentJson).toEqual([{ type: "CloseStream" }]);
  });
});

describe("voice socket", () => {
  async function connected() {
    const { open, sockets } = fakeOpen();
    const onAudio = vi.fn();
    const onError = vi.fn();
    const pending = connectTts("wss://tts", "browser-token", { onAudio, onError }, open);
    expect(sockets[0].protocols).toEqual(["bearer", "browser-token"]);
    sockets[0].open();
    return { tts: await pending, socket: sockets[0], onAudio, onError };
  }

  it("speaks each piece as Speak followed by Flush", async () => {
    const { tts, socket } = await connected();
    tts.speak("Hello there.");
    expect(socket.sentJson).toEqual([{ type: "Speak", text: "Hello there." }, { type: "Flush" }]);
  });

  it("measures the audio of each piece and hands the audio on", async () => {
    const { tts, socket, onAudio } = await connected();
    tts.speak("First sentence here.");
    tts.speak("Second one.");

    socket.json({ type: "SpeechStarted", speech_id: "a" });
    socket.receive(frame(48_000)); // 24 kHz, 16-bit: 1 s
    socket.receive(frame(24_000)); // 0.5 s
    socket.json({ type: "Flushed", speech_id: "a" });
    socket.json({ type: "SpeechStarted", speech_id: "b" });
    socket.receive(frame(48_000));
    socket.json({ type: "Flushed", speech_id: "b" });

    expect(onAudio).toHaveBeenCalledTimes(3);
    expect(tts.segments()).toEqual([
      { text: "First sentence here.", audioMs: 1500 },
      { text: "Second one.", audioMs: 1000 },
    ]);
  });

  it("finishes once every piece has been generated", async () => {
    const { tts, socket } = await connected();
    tts.speak("One.");
    tts.speak("Two.");
    let done = false;
    void tts.finish().then(() => (done = true));

    socket.json({ type: "Flushed", speech_id: "a" });
    await Promise.resolve();
    expect(done).toBe(false);
    socket.json({ type: "Flushed", speech_id: "b" });
    await Promise.resolve();
    expect(done).toBe(true);
  });

  it("does not wait for ever if the voice flushes fewer pieces than were sent", async () => {
    vi.useFakeTimers();
    try {
      const { tts, socket } = await connected();
      tts.speak("One.");
      tts.speak("Two.");
      socket.json({ type: "Flushed", speech_id: "a" });
      let done = false;
      void tts.finish().then(() => (done = true));
      await vi.advanceTimersByTimeAsync(3900);
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(200);
      expect(done).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("finishes at once when nothing was sent", async () => {
    const { tts } = await connected();
    await expect(tts.finish()).resolves.toBeUndefined();
  });

  it("stops on abort: closes the socket, ignores further text, and releases anyone waiting", async () => {
    const { tts, socket } = await connected();
    tts.speak("A long sentence that will never be finished.");
    const waiting = tts.finish();
    tts.abort();
    await expect(waiting).resolves.toBeUndefined();
    expect(socket.readyState).toBe(3);
    tts.speak("ignored");
    expect(socket.sentJson).toHaveLength(2);
  });

  it("reports the voice's errors in plain words", async () => {
    const { socket, onError } = await connected();
    socket.json({ type: "Error", code: "NET-0000" });
    expect(onError).toHaveBeenCalledWith("The voice failed (NET-0000).");
  });

  it("fails to connect when the socket closes before opening", async () => {
    const { open, sockets } = fakeOpen();
    const pending = connectTts("wss://tts", "t", { onAudio: vi.fn(), onError: vi.fn() }, open);
    sockets[0].close();
    await expect(pending).rejects.toThrow("Could not connect to the voice");
  });
});
