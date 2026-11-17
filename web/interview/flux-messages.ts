import * as z from "zod";

/**
 * What the two Deepgram sockets send as text. Shapes follow Deepgram's published message types
 * (TurnInfo for speech recognition, SpeechStarted / Flushed for the voice).
 * Anything that is not understood is ignored instead of breaking the interview.
 */

export type SttEvent = "StartOfTurn" | "Update" | "EagerEndOfTurn" | "TurnResumed" | "EndOfTurn";
const STT_EVENTS: readonly string[] = ["StartOfTurn", "Update", "EagerEndOfTurn", "TurnResumed", "EndOfTurn"];

export type SttMessage =
  | { kind: "turn"; event: SttEvent; transcript: string; /** End of the last word, in seconds of audio streamed. */ lastWordEndSec: number | null; languages: string[] }
  | { kind: "error"; message: string }
  | { kind: "ignored" };

const TurnInfoSchema = z.object({
  type: z.literal("TurnInfo"),
  event: z.string(),
  transcript: z.string().default(""),
  words: z.array(z.object({ end: z.number().optional() })).default([]),
  languages: z.array(z.string()).optional(),
});
const ErrorSchema = z.object({ type: z.literal("Error"), code: z.string().optional(), description: z.string().optional() });

function json(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function parseSttMessage(raw: string): SttMessage {
  const data = json(raw);
  const turn = TurnInfoSchema.safeParse(data);
  if (turn.success) {
    if (!STT_EVENTS.includes(turn.data.event)) return { kind: "ignored" };
    const ends = turn.data.words.flatMap((w) => (w.end === undefined ? [] : [w.end]));
    return { kind: "turn", event: turn.data.event as SttEvent, transcript: turn.data.transcript, lastWordEndSec: ends.length ? ends[ends.length - 1] : null, languages: turn.data.languages ?? [] };
  }
  const error = ErrorSchema.safeParse(data);
  if (error.success) return { kind: "error", message: `Speech recognition failed${error.data.code ? ` (${error.data.code})` : ""}.` };
  return { kind: "ignored" };
}

export type TtsMessage =
  | { kind: "speechStarted" }
  | { kind: "flushed" }
  | { kind: "error"; message: string }
  | { kind: "ignored" };

export function parseTtsMessage(raw: string): TtsMessage {
  const data = json(raw);
  const type = typeof data === "object" && data !== null && "type" in data ? (data as { type: unknown }).type : null;
  if (type === "SpeechStarted") return { kind: "speechStarted" };
  if (type === "Flushed") return { kind: "flushed" };
  if (type === "Error") {
    const error = ErrorSchema.safeParse(data);
    return { kind: "error", message: `The voice failed${error.success && error.data.code ? ` (${error.data.code})` : ""}.` };
  }
  return { kind: "ignored" };
}
