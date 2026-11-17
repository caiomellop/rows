import { describe, expect, it } from "vitest";

import { MoveTagParser } from "./moves";

function run(pieces: string[]) {
  const parser = new MoveTagParser();
  const spoken = pieces.map((p) => parser.push(p)).join("") + parser.flush();
  return { move: parser.move, spoken };
}

describe("move tag parser", () => {
  it("reads the tag and passes the rest on", () => {
    expect(run(["[[NEXT]] Got it. Next question."])).toEqual({ move: "NEXT", spoken: "Got it. Next question." });
  });

  it("reads a tag split across many streamed pieces", () => {
    const result = run(["[", "[FOLLOW", "_UP]", "] And ", "what happened next?"]);
    expect(result).toEqual({ move: "FOLLOW_UP", spoken: "And what happened next?" });
  });

  it("reads the repeat tag", () => {
    expect(run(["[[REPEAT]] Sure. What did your team own?"])).toEqual({ move: "REPEAT", spoken: "Sure. What did your team own?" });
  });

  it("is case and space tolerant", () => {
    expect(run(["  [[ end ]]Thank you, goodbye."])).toEqual({ move: "END", spoken: "Thank you, goodbye." });
  });

  it("passes text through unchanged when there is no tag", () => {
    expect(run(["Tell me ", "about yourself."])).toEqual({ move: null, spoken: "Tell me about yourself." });
  });

  it("drops an unknown tag but keeps what follows", () => {
    expect(run(["[[SKIP]] Fine."])).toEqual({ move: null, spoken: "Fine." });
  });

  it("does not hold back a short reply that never became a tag", () => {
    expect(run(["O"])).toEqual({ move: null, spoken: "O" });
  });

  it("gives up on a tag that never closes", () => {
    const text = "[[NEXT is a very long unclosed thing that keeps going";
    expect(run([text]).spoken).toBe(text);
  });
});
