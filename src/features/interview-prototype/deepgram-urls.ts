import type { Language } from "./languages";

/**
 * The Deepgram WebSocket addresses. No secret here: the browser opens both sockets with a
 * short-lived token the server mints (see deepgram.ts), so this file is shared with the client.
 */

/** Flux Multilingual: streaming speech recognition with built-in end-of-turn detection. */
export const STT_MODEL = "flux-general-multi";
export const STT_SAMPLE_RATE = 16_000;
export const TTS_SAMPLE_RATE = 24_000;

/**
 * End-of-turn confidence needed to close the candidate's turn (0.5 to 1.0, default 0.7).
 * A higher value waits a little longer, so a pause to think is less likely to cut the candidate off.
 */
const END_OF_TURN_THRESHOLD = "0.8";

/** The recognizer is told which language to expect: the one of the voice the candidate chose. */
export function listenUrl(language: Language): string {
  const query = new URLSearchParams({ model: STT_MODEL, encoding: "linear16", sample_rate: String(STT_SAMPLE_RATE), eot_threshold: END_OF_TURN_THRESHOLD, language_hint: language });
  return `wss://api.deepgram.com/v2/listen?${query}`;
}

/** A Flux TTS model string: flux-{voice}-{language}, for example flux-cliff-en. */
export function isFluxVoice(value: string): boolean {
  return /^flux-[a-z]+-[a-z]{2}$/.test(value);
}

export type SpeakOptions = {
  /** Speaking rate, 0.5 to 1.5 in steps of 0.05. 1 is the voice's own pace. */
  speed?: number;
  /** -2 (calm) to 2 (animated), whole numbers. 0 is the voice's tuned delivery. */
  expressivity?: number;
};

const validSpeed = (speed: number) => speed >= 0.5 && speed <= 1.5 && Math.abs(speed * 20 - Math.round(speed * 20)) < 1e-9;
const validExpressivity = (value: number) => Number.isInteger(value) && value >= -2 && value <= 2;

export function speakUrl(voice: string, options: SpeakOptions = {}): string {
  if (!isFluxVoice(voice)) throw new Error(`"${voice}" is not a Flux voice (expected flux-{voice}-{language}).`);
  const query = new URLSearchParams({ model: voice, encoding: "linear16", sample_rate: String(TTS_SAMPLE_RATE) });
  // Deepgram rejects values outside these ranges with a 400, which would close the socket: fail here with a clear message.
  if (options.speed !== undefined) {
    if (!validSpeed(options.speed)) throw new Error(`Speed ${options.speed} is not valid (0.5 to 1.5 in steps of 0.05).`);
    query.set("speed", String(options.speed));
  }
  if (options.expressivity !== undefined) {
    if (!validExpressivity(options.expressivity)) throw new Error(`Expressivity ${options.expressivity} is not valid (-2 to 2, whole numbers).`);
    query.set("expressivity", String(options.expressivity));
  }
  return `wss://api.deepgram.com/v2/speak?${query}`;
}
