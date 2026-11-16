/**
 * The languages the prototype interviews in and the voices that speak them: the one place to change
 * either. The page, the routes, the prompts and the speech settings all read from here. It holds no
 * secrets, so the browser imports it too.
 *
 * A Flux voice speaks one language (the model name is flux-{name}-{language}), so the voice chosen on
 * the setup form also chooses the language of the interview. Speed runs from 0.5 to 1.5 (1 is the
 * voice's own pace) and expressivity from -2 (calm) to 2 (animated); both are Deepgram Flux TTS
 * settings. The flag in each label is the country the voice comes from.
 */

/** How the prompts name each language. The keys are the language codes Deepgram uses. */
export const LANGUAGE_NAMES = {
  en: "English",
  es: "Spanish (Spain)",
  pt: "Brazilian Portuguese",
  fr: "French",
} as const;

export type Language = keyof typeof LANGUAGE_NAMES;

export const LANGUAGES = Object.keys(LANGUAGE_NAMES) as [Language, ...Language[]];

type VoiceSpec = { id: string; label: string; language: Language; model: string; speed: number; expressivity: number };

/** In the order the drop-down shows them. */
export const VOICES = [
  { id: "cliff", label: "🇺🇸 Cliff", language: "en", model: "flux-cliff-en", speed: 0.9, expressivity: 1 },
  { id: "sienna", label: "🇺🇸 Sienna", language: "en", model: "flux-sienna-en", speed: 0.9, expressivity: 1 },
  { id: "eduardo", label: "🇪🇸 Eduardo", language: "es", model: "flux-eduardo-es", speed: 0.9, expressivity: 0 },
  { id: "roberto", label: "🇧🇷 Roberto", language: "pt", model: "flux-roberto-pt", speed: 0.9, expressivity: 1 },
  { id: "mathieu", label: "🇫🇷 Mathieu", language: "fr", model: "flux-mathieu-fr", speed: 0.9, expressivity: 0 },
] as const satisfies readonly VoiceSpec[];

export type VoiceId = (typeof VOICES)[number]["id"];

export const VOICE_IDS = VOICES.map((voice) => voice.id) as [VoiceId, ...VoiceId[]];

export const DEFAULT_VOICE: VoiceId = "cliff";

export function voiceById(id: VoiceId) {
  return VOICES.find((voice) => voice.id === id) ?? VOICES[0];
}
