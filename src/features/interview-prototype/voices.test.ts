import { describe, expect, it } from "vitest";

import { isFluxVoice, speakUrl } from "./deepgram-urls";
import { DEFAULT_VOICE, VOICE_IDS, VOICES, voiceById } from "./voices";

describe("interviewer voices", () => {
  it("offers exactly Cliff and Sienna, each at 0.9x with expressivity 1", () => {
    expect(VOICES.map(({ label, model, speed, expressivity }) => ({ label, model, speed, expressivity }))).toEqual([
      { label: "Cliff", model: "flux-cliff-en", speed: 0.9, expressivity: 1 },
      { label: "Sienna", model: "flux-sienna-en", speed: 0.9, expressivity: 1 },
    ]);
  });

  it("starts on Cliff", () => {
    expect(DEFAULT_VOICE).toBe("cliff");
    expect(VOICE_IDS[0]).toBe(DEFAULT_VOICE);
  });

  it("only uses Flux voices and settings Deepgram accepts, so no voice can close the socket", () => {
    expect(new Set(VOICE_IDS).size).toBe(VOICES.length);
    for (const voice of VOICES) {
      expect(isFluxVoice(voice.model)).toBe(true);
      expect(() => speakUrl(voice.model, { speed: voice.speed, expressivity: voice.expressivity })).not.toThrow();
    }
  });

  it("finds a voice by id", () => {
    expect(voiceById("sienna").model).toBe("flux-sienna-en");
    expect(voiceById("cliff").model).toBe("flux-cliff-en");
  });
});
