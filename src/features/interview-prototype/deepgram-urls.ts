import { LANGUAGES } from "./schemas";

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

export function listenUrl(): string {
  const query = new URLSearchParams({ model: STT_MODEL, encoding: "linear16", sample_rate: String(STT_SAMPLE_RATE), eot_threshold: END_OF_TURN_THRESHOLD });
  // Both interview languages are hinted: the model still detects which one is spoken, even mid-answer.
  for (const language of LANGUAGES) query.append("language_hint", language);
  return `wss://api.deepgram.com/v2/listen?${query}`;
}

/** A Flux TTS model string: flux-{voice}-{language}, for example flux-cliff-en. */
export function isFluxVoice(value: string): boolean {
  return /^flux-[a-z]+-[a-z]{2}$/.test(value);
}

export function speakUrl(voice: string): string {
  if (!isFluxVoice(voice)) throw new Error(`"${voice}" is not a Flux voice (expected flux-{voice}-{language}).`);
  const query = new URLSearchParams({ model: voice, encoding: "linear16", sample_rate: String(TTS_SAMPLE_RATE) });
  return `wss://api.deepgram.com/v2/speak?${query}`;
}
