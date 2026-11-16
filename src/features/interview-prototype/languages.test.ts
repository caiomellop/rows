import { describe, expect, it } from "vitest";

import { isFluxVoice, speakUrl } from "./deepgram-urls";
import { DEFAULT_VOICE, LANGUAGE_NAMES, LANGUAGES, VOICE_IDS, VOICES, voiceById } from "./languages";

describe("interview languages", () => {
  it("are English, Spanish, Brazilian Portuguese and French, and nothing else", () => {
    expect(LANGUAGES).toEqual(["en", "es", "pt", "fr"]);
    expect(LANGUAGE_NAMES).toEqual({ en: "English", es: "Spanish (Spain)", pt: "Brazilian Portuguese", fr: "French" });
  });

  it("each have a voice, so no language can be interviewed in without one", () => {
    for (const language of LANGUAGES) expect(VOICES.some((voice) => voice.language === language)).toBe(true);
  });
});

describe("interviewer voices", () => {
  it("are Cliff and Sienna in English, Eduardo in Spanish, Roberto in Portuguese and Mathieu in French, each with its flag and settings", () => {
    expect(VOICES.map(({ label, language, model, speed, expressivity }) => ({ label, language, model, speed, expressivity }))).toEqual([
      { label: "🇺🇸 Cliff", language: "en", model: "flux-cliff-en", speed: 0.9, expressivity: 1 },
      { label: "🇺🇸 Sienna", language: "en", model: "flux-sienna-en", speed: 0.9, expressivity: 1 },
      { label: "🇪🇸 Eduardo", language: "es", model: "flux-eduardo-es", speed: 0.9, expressivity: 0 },
      { label: "🇧🇷 Roberto", language: "pt", model: "flux-roberto-pt", speed: 0.9, expressivity: 1 },
      { label: "🇫🇷 Mathieu", language: "fr", model: "flux-mathieu-fr", speed: 0.9, expressivity: 0 },
    ]);
  });

  it("start on Cliff", () => {
    expect(DEFAULT_VOICE).toBe("cliff");
    expect(VOICE_IDS[0]).toBe(DEFAULT_VOICE);
  });

  it("are named after their language, so a voice and its language cannot disagree", () => {
    for (const voice of VOICES) expect(voice.model).toBe(`flux-${voice.id}-${voice.language}`);
  });

  it("only use Flux voices and settings Deepgram accepts, so no voice can close the socket", () => {
    expect(new Set(VOICE_IDS).size).toBe(VOICES.length);
    for (const voice of VOICES) {
      expect(isFluxVoice(voice.model)).toBe(true);
      expect(() => speakUrl(voice.model, { speed: voice.speed, expressivity: voice.expressivity })).not.toThrow();
    }
  });

  it("are found by id", () => {
    expect(voiceById("eduardo").language).toBe("es");
    expect(voiceById("sienna").model).toBe("flux-sienna-en");
  });
});
