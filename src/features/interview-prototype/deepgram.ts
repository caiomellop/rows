import "server-only";

import { z } from "zod";

import { isFluxVoice, type SpeakOptions } from "./deepgram-urls";
import type { Language } from "./schemas";
import { voiceById, type VoiceId } from "./voices";

/**
 * Server side of Deepgram: the API key never leaves here. The browser gets a short-lived token and
 * opens the speech and voice WebSockets itself, because Vercel functions cannot hold a WebSocket.
 */

export class DeepgramError extends Error {}

/** The Portuguese voice: a male voice. Any flux-*-pt voice works (DEEPGRAM_TTS_VOICE_PT). */
export const DEFAULT_PT_VOICE = "flux-bruno-pt";

/** DEEPGRAM_API_KEYS holds one key; if several are listed with commas, the first is used. */
function apiKey(): string | null {
  const first = (process.env.DEEPGRAM_API_KEYS ?? "")
    .split(",")
    .map((key) => key.trim())
    .find(Boolean);
  return first ?? null;
}

export type TtsSettings = { model: string } & SpeakOptions;

/**
 * The voice for one interview. English uses the voice chosen on the form, with its own speed and
 * expressivity. Portuguese has a single voice for now, because the English voices cannot read it.
 */
export function ttsSettings(language: Language, voiceId: VoiceId): TtsSettings {
  if (language === "en") {
    const { model, speed, expressivity } = voiceById(voiceId);
    return { model, speed, expressivity };
  }
  const model = process.env.DEEPGRAM_TTS_VOICE_PT?.trim() || DEFAULT_PT_VOICE;
  if (!isFluxVoice(model)) throw new DeepgramError(`The Portuguese voice "${model}" is not valid. Use a Flux voice such as ${DEFAULT_PT_VOICE}.`);
  return { model };
}

const GrantSchema = z.object({ access_token: z.string().min(1) });

/** A token for the browser. It only has to be valid when each socket opens, so the lifetime covers the interview. */
export async function mintBrowserToken(ttlSeconds: number): Promise<string> {
  const key = apiKey();
  if (!key) throw new DeepgramError("Deepgram is not configured. Set DEEPGRAM_API_KEYS.");

  const res = await fetch("https://api.deepgram.com/v1/auth/grant", {
    method: "POST",
    headers: { Authorization: `Token ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ttl_seconds: Math.min(3600, Math.max(30, Math.round(ttlSeconds))) }),
    cache: "no-store",
  });

  if (res.status === 401) throw new DeepgramError("Deepgram rejected the key. Check DEEPGRAM_API_KEYS.");
  if (res.status === 403) throw new DeepgramError("This Deepgram key cannot create temporary tokens. Use a key with the Member role.");
  if (!res.ok) throw new DeepgramError(`Deepgram could not create a token (${res.status}). Try again.`);

  const body = GrantSchema.safeParse(await res.json().catch(() => null));
  if (!body.success) throw new DeepgramError("Deepgram returned an unreadable token response.");
  return body.data.access_token;
}
