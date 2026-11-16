import { describe, expect, it } from "vitest";

import { parseSttMessage, parseTtsMessage } from "./flux-messages";

const turnInfo = (event: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    type: "TurnInfo",
    request_id: "r1",
    sequence_id: 4,
    event,
    turn_index: 0,
    audio_window_start: 0,
    audio_window_end: 3.4,
    transcript: "So, um, I have, like, five years",
    words: [
      { word: "So,", confidence: 0.99, start: 0.1, end: 0.5 },
      { word: "years", confidence: 0.97, start: 3.0, end: 3.4 },
    ],
    end_of_turn_confidence: 0.91,
    ...extra,
  });

describe("speech recognition messages", () => {
  it("reads a turn: the event, the text so far, the end of the last word and the detected languages", () => {
    expect(parseSttMessage(turnInfo("EndOfTurn", { languages: ["en"] }))).toEqual({
      kind: "turn",
      event: "EndOfTurn",
      transcript: "So, um, I have, like, five years",
      lastWordEndSec: 3.4,
      languages: ["en"],
    });
  });

  it("copes with a turn that has no words yet", () => {
    expect(parseSttMessage(turnInfo("StartOfTurn", { words: [], transcript: "" }))).toMatchObject({ kind: "turn", event: "StartOfTurn", lastWordEndSec: null, languages: [] });
  });

  it("ignores events it does not know, so new ones from Deepgram cannot break a live interview", () => {
    expect(parseSttMessage(turnInfo("SomethingNew"))).toEqual({ kind: "ignored" });
  });

  it("ignores connection and warning messages and anything that is not JSON", () => {
    expect(parseSttMessage(JSON.stringify({ type: "Connected", request_id: "r", sequence_id: 0 }))).toEqual({ kind: "ignored" });
    expect(parseSttMessage("not json")).toEqual({ kind: "ignored" });
  });

  it("turns an error message into a plain sentence without the provider's text", () => {
    expect(parseSttMessage(JSON.stringify({ type: "Error", sequence_id: 2, code: "INTERNAL_SERVER_ERROR", description: "details" }))).toEqual({
      kind: "error",
      message: "Speech recognition failed (INTERNAL_SERVER_ERROR).",
    });
  });
});

describe("voice messages", () => {
  it("reads the markers of one spoken piece", () => {
    expect(parseTtsMessage(JSON.stringify({ type: "SpeechStarted", speech_id: "dg_sp_1" }))).toEqual({ kind: "speechStarted" });
    expect(parseTtsMessage(JSON.stringify({ type: "Flushed", speech_id: "dg_sp_1" }))).toEqual({ kind: "flushed" });
  });

  it("turns an error into a plain sentence and ignores the rest", () => {
    expect(parseTtsMessage(JSON.stringify({ type: "Error", code: "DATA-0002", description: "bad control" }))).toEqual({ kind: "error", message: "The voice failed (DATA-0002)." });
    expect(parseTtsMessage(JSON.stringify({ type: "Connected", request_id: "r" }))).toEqual({ kind: "ignored" });
    expect(parseTtsMessage("???")).toEqual({ kind: "ignored" });
  });
});
