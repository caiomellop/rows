import type { Language } from "./languages";

/**
 * The interviewer's voices (CAI-86). The form offers two, Cliff and Sienna. Both speak at 0.9x with
 * expressivity 1 (Deepgram Flux TTS: speed 0.5 to 1.5, expressivity -2 calm to 2 animated).
 */
export const VOICE_SPEED = 0.9;
export const VOICE_EXPRESSIVITY = 1;

export const VOICES = [
  { id: "cliff", label: "Cliff" },
  { id: "sienna", label: "Sienna" },
] as const;

export type VoiceId = (typeof VOICES)[number]["id"];

export const VOICE_IDS = VOICES.map((voice) => voice.id) as [VoiceId, ...VoiceId[]];

export const DEFAULT_VOICE: VoiceId = "cliff";

/**
 * Flux voices belong to one language: Cliff and Sienna exist only in English, and an English voice
 * reading another language is unreliable (tested with speech recognition: Spanish word error rate
 * 0.40 and 0.60, German 0.44 and 0.25). So in every other language each choice is a native voice
 * of the same kind, picked by pitch: the native voice closest to Cliff (130 Hz) or Sienna (187 Hz).
 * All of them were checked at 0.9x with expressivity 1, and read back with word error rate 0 to 0.03
 * (0.18 in Hindi, where the recognizer wrote one word in Latin letters). Japanese has only four voices.
 */
export const FLUX_VOICES: Record<Language, Record<VoiceId, string>> = {
  en: { cliff: "flux-cliff-en", sienna: "flux-sienna-en" },
  pt: { cliff: "flux-bruno-pt", sienna: "flux-mariana-pt" },
  es: { cliff: "flux-eduardo-es", sienna: "flux-carmen-es" },
  fr: { cliff: "flux-pierre-fr", sienna: "flux-veronique-fr" },
  de: { cliff: "flux-tobias-de", sienna: "flux-leonie-de" },
  it: { cliff: "flux-stefano-it", sienna: "flux-sofia-it" },
  nl: { cliff: "flux-bram-nl", sienna: "flux-lotte-nl" },
  hi: { cliff: "flux-arjun-hi", sienna: "flux-anjali-hi" },
  ru: { cliff: "flux-maxim-ru", sienna: "flux-olga-ru" },
  ja: { cliff: "flux-hayato-ja", sienna: "flux-ayumi-ja" },
};

/** The voice socket settings for one interview: the chosen voice in the interview's language. */
export function voiceFor(language: Language, id: VoiceId) {
  return { model: FLUX_VOICES[language][id], speed: VOICE_SPEED, expressivity: VOICE_EXPRESSIVITY };
}
