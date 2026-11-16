import { describe, expect, it } from "vitest";

import { SentenceChunker } from "./sentences";

function chunk(pieces: string[]) {
  const chunker = new SentenceChunker();
  return [...pieces.flatMap((p) => chunker.push(p)), ...chunker.flush()];
}

describe("sentence chunker", () => {
  it("emits one piece per sentence as soon as the sentence ends", () => {
    const chunker = new SentenceChunker();
    expect(chunker.push("Thanks, that is clear. ")).toEqual(["Thanks, that is clear."]);
    expect(chunker.push("What was your own role in it")).toEqual([]);
    expect(chunker.push("? ")).toEqual(["What was your own role in it?"]);
  });

  it("lets the first piece end at a comma so the voice starts sooner", () => {
    expect(chunk(["Thanks for walking me through that, now let us talk about the API. ", "How do you version it?"])).toEqual([
      "Thanks for walking me through that,",
      "now let us talk about the API.",
      "How do you version it?",
    ]);
  });

  it("only cuts at commas for the first piece", () => {
    const pieces = chunk(["Good answer. Next, I would like to know how you handle disagreement with a teammate, and why. "]);
    expect(pieces).toEqual(["Good answer.", "Next, I would like to know how you handle disagreement with a teammate, and why."]);
  });

  it("holds a tiny first sentence and joins it to the next", () => {
    expect(chunk(["Sure. Tell me about your last project. "])).toEqual(["Sure. Tell me about your last project."]);
  });

  it("does not cut inside numbers or after abbreviations", () => {
    const text = "Please say hello to our colleague Dr. Silva before we start. The system handled 3.5 million requests per day.";
    expect(chunk([text])).toEqual(["Please say hello to our colleague Dr. Silva before we start.", "The system handled 3.5 million requests per day."]);
  });

  it("flushes the tail that has no final punctuation", () => {
    const chunker = new SentenceChunker();
    expect(chunker.push("Tell me about a time you led a team")).toEqual([]);
    expect(chunker.flush()).toEqual(["Tell me about a time you led a team"]);
  });

  it("returns nothing for an empty stream", () => {
    expect(chunk([])).toEqual([]);
    expect(chunk(["   "])).toEqual([]);
  });
});
