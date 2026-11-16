import { describe, expect, it } from "vitest";

import { addLlmUsage, emptyUsage, estimateCost, latencyFromMarks, resultsMarkdown, summarizeLatency, type TurnLatency } from "./metrics";

const turn = (n: number, totalMs: number): TurnLatency => ({ turn: n, detectMs: 300, modelMs: 500, sentenceMs: 100, voiceMs: totalMs - 900, totalMs });

describe("latency", () => {
  it("measures from the candidate's last word to the first audio, with the parts that make it up", () => {
    const latency = latencyFromMarks(2, { lastWordAt: 10_000, endOfTurnAt: 10_320, firstTokenAt: 10_850, speakSentAt: 10_990, playAt: 11_240 });
    expect(latency).toEqual({ turn: 2, detectMs: 320, modelMs: 530, sentenceMs: 140, voiceMs: 250, totalMs: 1240 });
  });

  it("never reports negative time when clocks jitter", () => {
    const latency = latencyFromMarks(1, { lastWordAt: 100, endOfTurnAt: 90, firstTokenAt: 200, speakSentAt: 200, playAt: 300 });
    expect(latency.detectMs).toBe(0);
  });

  it("summarizes average, percentiles and how many replies met the goals", () => {
    const summary = summarizeLatency([turn(1, 900), turn(2, 1100), turn(3, 1500), turn(4, 2600)]);
    expect(summary).toMatchObject({ count: 4, avgMs: 1525, p50Ms: 1100, p90Ms: 2600, maxMs: 2600, under1s: 1, under2s: 3 });
    expect(summary?.avg.modelMs).toBe(500);
  });

  it("has no summary without measurements", () => {
    expect(summarizeLatency([])).toBeNull();
  });
});

describe("cost", () => {
  it("adds up speech recognition, voice, live turns and the report", () => {
    const usage = emptyUsage();
    usage.sttSeconds = 600; // 10 minutes
    usage.ttsChars = 4000;
    usage.llm = { input: 200_000, output: 10_000, cacheRead: 100_000, cacheWrite: 5_000 };
    usage.feedback = { input: 8_000, output: 1_500, cacheRead: 0, cacheWrite: 0 };
    const cost = estimateCost(usage, 10);
    expect(cost.sttUsd).toBeCloseTo(0.078, 5);
    expect(cost.ttsUsd).toBeCloseTo(0.18, 5);
    expect(cost.llmUsd).toBeCloseTo(0.02 + 0.005 + 0.001 + 0.000625, 6);
    expect(cost.feedbackUsd).toBeCloseTo(0.032 + 0.03, 6);
    expect(cost.per30MinUsd).toBeCloseTo(cost.totalUsd * 3, 6);
  });

  it("does not scale a run shorter than a minute", () => {
    expect(estimateCost(emptyUsage(), 0.5).per30MinUsd).toBeNull();
  });

  it("adds Claude usage", () => {
    expect(addLlmUsage({ input: 1, output: 2, cacheRead: 3, cacheWrite: 4 }, { input: 10, output: 20, cacheRead: 30, cacheWrite: 40 })).toEqual({ input: 11, output: 22, cacheRead: 33, cacheWrite: 44 });
  });
});

describe("results block for the Linear issue", () => {
  it("carries latency, the 30-minute cost and placeholders for the human verdict", () => {
    const usage = emptyUsage();
    usage.sttSeconds = 300;
    const text = resultsMarkdown({ language: "en", minutes: 5, candidateTurns: 4, latencies: [turn(1, 1200), turn(2, 800)], usage });
    expect(text).toContain("EN, 5.0 min, 4 candidate turns");
    expect(text).toContain("avg 1000 ms");
    expect(text).toContain("Under 1 s: 1/2");
    expect(text).toContain("Estimated cost for 30 min");
    expect(text).toContain("Transcription quality");
    expect(text).toContain("Verdict");
  });

  it("says so when nothing was measured", () => {
    expect(resultsMarkdown({ language: "en", minutes: 2, candidateTurns: 0, latencies: [], usage: emptyUsage() })).toContain("nothing was measured");
  });
});
