/**
 * The interview languages: the ten that Deepgram Flux Multilingual (flux-general-multi) understands.
 * Flux TTS has native voices for all ten. The language of the job description picks the interview
 * language, and the speech recognizer detects the spoken language by itself.
 */
export const LANGUAGES = ["en", "pt", "es", "fr", "de", "it", "nl", "hi", "ru", "ja"] as const;
export type Language = (typeof LANGUAGES)[number];

/** How the prompts name each language. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  pt: "Brazilian Portuguese",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  nl: "Dutch",
  hi: "Hindi",
  ru: "Russian",
  ja: "Japanese",
};
