import { describe, expect, it } from "vitest";

import { isFluxVoice, speakUrl } from "./deepgram-urls";
import { LANGUAGE_NAMES, LANGUAGES } from "./languages";
import { DEFAULT_VOICE, FLUX_VOICES, VOICE_EXPRESSIVITY, VOICE_IDS, VOICE_SPEED, VOICES, voiceFor } from "./voices";

describe("the two voices on the form", () => {
  it("offers exactly Cliff and Sienna, with Cliff selected by default", () => {
    expect(VOICES.map((voice) => voice.label)).toEqual(["Cliff", "Sienna"]);
    expect(DEFAULT_VOICE).toBe("cliff");
    expect(VOICE_IDS[0]).toBe(DEFAULT_VOICE);
  });

  it("speaks at 0.9x with expressivity 1", () => {
    expect(VOICE_SPEED).toBe(0.9);
    expect(VOICE_EXPRESSIVITY).toBe(1);
  });

  it("is Cliff and Sienna themselves in English", () => {
    expect(voiceFor("en", "cliff")).toEqual({ model: "flux-cliff-en", speed: 0.9, expressivity: 1 });
    expect(voiceFor("en", "sienna")).toEqual({ model: "flux-sienna-en", speed: 0.9, expressivity: 1 });
  });
});

describe("voices in every interview language", () => {
  it("covers the ten languages Flux Multilingual understands, and no others", () => {
    expect([...LANGUAGES].sort()).toEqual(["de", "en", "es", "fr", "hi", "it", "ja", "nl", "pt", "ru"]);
    expect(Object.keys(FLUX_VOICES).sort()).toEqual([...LANGUAGES].sort());
    expect(Object.keys(LANGUAGE_NAMES).sort()).toEqual([...LANGUAGES].sort());
  });

  it("gives both choices a voice in every language, and that voice speaks that language (flux-{name}-{language})", () => {
    for (const language of LANGUAGES) {
      for (const id of VOICE_IDS) {
        const { model } = voiceFor(language, id);
        expect(isFluxVoice(model), model).toBe(true);
        expect(model.endsWith(`-${language}`), `${model} for ${language}`).toBe(true);
      }
    }
  });

  it("never gives Cliff and Sienna the same voice, and never reuses a voice in another language", () => {
    const models = LANGUAGES.flatMap((language) => VOICE_IDS.map((id) => voiceFor(language, id).model));
    expect(new Set(models).size).toBe(models.length);
  });

  it("only uses settings Deepgram accepts, so no voice can close the socket mid-interview", () => {
    for (const language of LANGUAGES) {
      for (const id of VOICE_IDS) {
        const { model, speed, expressivity } = voiceFor(language, id);
        expect(() => speakUrl(model, { speed, expressivity })).not.toThrow();
      }
    }
  });

  it("opens the Spanish interview with the Spanish counterpart of the chosen voice", () => {
    const { model, speed, expressivity } = voiceFor("es", "sienna");
    const url = new URL(speakUrl(model, { speed, expressivity }));
    expect([url.searchParams.get("model"), url.searchParams.get("speed"), url.searchParams.get("expressivity")]).toEqual(["flux-carmen-es", "0.9", "1"]);
  });
});
