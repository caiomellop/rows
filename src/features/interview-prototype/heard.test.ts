import { describe, expect, it } from "vitest";

import { heardText, type Segment } from "./heard";

const segments: Segment[] = [
  { text: "Thanks for that answer.", audioMs: 1500 },
  { text: "Now tell me about a time you led a small team.", audioMs: 3000 },
  { text: "What was the outcome?", audioMs: 1500 },
];

describe("heard text after an interruption", () => {
  it("is empty if nothing played yet", () => {
    expect(heardText(segments, 0)).toBe("");
  });

  it("keeps whole pieces that finished playing", () => {
    expect(heardText(segments, 1500)).toBe("Thanks for that answer.");
  });

  it("keeps the matching share of the piece that was playing, cut at a word", () => {
    // 1,500 ms of 3,000 ms in the second piece: half of its 10 words.
    expect(heardText(segments, 3000)).toBe("Thanks for that answer. Now tell me about a");
  });

  it("is the whole message if everything played", () => {
    expect(heardText(segments, 99_999)).toBe("Thanks for that answer. Now tell me about a time you led a small team. What was the outcome?");
  });

  it("counts characters for a language written without spaces", () => {
    const japanese: Segment[] = [{ text: "共有してくださってありがとうございます。", audioMs: 2000 }];
    // Half of the 20 characters were heard: the first 10.
    expect(heardText(japanese, 1000)).toBe("共有してくださってあ");
    expect(heardText(japanese, 2000)).toBe("共有してくださってありがとうございます。");
  });

  it("never invents words for a piece without audio", () => {
    expect(heardText([{ text: "Hello there", audioMs: 0 }], 500)).toBe("");
  });
});
