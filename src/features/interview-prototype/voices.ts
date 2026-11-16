/**
 * The interviewer's voices, chosen on the setup form (CAI-86). Speed and expressivity are Deepgram
 * Flux TTS settings: speed from 0.5 to 1.5 (1 is the voice's own pace) and expressivity from -2 (calm)
 * to 2 (animated). Both voices are English, like the interview itself.
 */
export const VOICES = [
  { id: "cliff", label: "Cliff", model: "flux-cliff-en", speed: 0.9, expressivity: 1 },
  { id: "sienna", label: "Sienna", model: "flux-sienna-en", speed: 0.9, expressivity: 1 },
] as const;

export type VoiceId = (typeof VOICES)[number]["id"];

export const VOICE_IDS = VOICES.map((voice) => voice.id) as [VoiceId, ...VoiceId[]];

export const DEFAULT_VOICE: VoiceId = "cliff";

export function voiceById(id: VoiceId) {
  return VOICES.find((voice) => voice.id === id) ?? VOICES[0];
}
