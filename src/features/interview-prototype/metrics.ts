import type { Language } from "./schemas";

/* ------------------------------------------------------------------ */
/* Latency: from the candidate's last word to the first audio heard    */
/* ------------------------------------------------------------------ */

/** Moments of one turn, all on the same clock (milliseconds). */
export type LatencyMarks = {
  /** The candidate's last word ended. */
  lastWordAt: number;
  /** The end of the turn was detected. */
  endOfTurnAt: number;
  /** The first text of the reply reached the browser. */
  firstTokenAt: number;
  /** The first sentence was sent to the voice. */
  speakSentAt: number;
  /** The first audio started to play. */
  playAt: number;
};

export type TurnLatency = {
  /** 1-based number of the interviewer reply. */
  turn: number;
  /** Last word to end of turn detected. */
  detectMs: number;
  /** End of turn to first text from Claude (includes the server hop). */
  modelMs: number;
  /** First text to the first sentence sent to the voice. */
  sentenceMs: number;
  /** First sentence sent to audio playing. */
  voiceMs: number;
  /** Last word to first audio heard: the number the issue asks for. */
  totalMs: number;
};

const span = (from: number, to: number) => Math.max(0, Math.round(to - from));

export function latencyFromMarks(turn: number, m: LatencyMarks): TurnLatency {
  return {
    turn,
    detectMs: span(m.lastWordAt, m.endOfTurnAt),
    modelMs: span(m.endOfTurnAt, m.firstTokenAt),
    sentenceMs: span(m.firstTokenAt, m.speakSentAt),
    voiceMs: span(m.speakSentAt, m.playAt),
    totalMs: span(m.lastWordAt, m.playAt),
  };
}

export type LatencySummary = {
  count: number;
  avgMs: number;
  p50Ms: number;
  p90Ms: number;
  maxMs: number;
  /** Replies with the first audio in under 1 s (the goal) and in 2 s or less (the limit). */
  under1s: number;
  under2s: number;
  /** Average of each part of the delay. */
  avg: Pick<TurnLatency, "detectMs" | "modelMs" | "sentenceMs" | "voiceMs">;
};

function percentile(sorted: number[], p: number): number {
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
}

const mean = (values: number[]) => Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);

export function summarizeLatency(items: TurnLatency[]): LatencySummary | null {
  if (items.length === 0) return null;
  const totals = items.map((i) => i.totalMs).sort((a, b) => a - b);
  return {
    count: items.length,
    avgMs: mean(totals),
    p50Ms: percentile(totals, 50),
    p90Ms: percentile(totals, 90),
    maxMs: totals[totals.length - 1],
    under1s: totals.filter((t) => t < 1000).length,
    under2s: totals.filter((t) => t <= 2000).length,
    avg: {
      detectMs: mean(items.map((i) => i.detectMs)),
      modelMs: mean(items.map((i) => i.modelMs)),
      sentenceMs: mean(items.map((i) => i.sentenceMs)),
      voiceMs: mean(items.map((i) => i.voiceMs)),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Usage and cost                                                      */
/* ------------------------------------------------------------------ */

export type LlmUsage = { input: number; output: number; cacheRead: number; cacheWrite: number };

export type Usage = {
  /** Seconds of microphone audio streamed to the speech recognizer. */
  sttSeconds: number;
  /** Characters sent to the voice. */
  ttsChars: number;
  /** Claude Haiku: the question plan and the live turns. */
  llm: LlmUsage;
  /** Claude Opus: the feedback report. */
  feedback: LlmUsage;
};

export const emptyLlmUsage = (): LlmUsage => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
export const emptyUsage = (): Usage => ({ sttSeconds: 0, ttsChars: 0, llm: emptyLlmUsage(), feedback: emptyLlmUsage() });

export function addLlmUsage(a: LlmUsage, b: LlmUsage): LlmUsage {
  return { input: a.input + b.input, output: a.output + b.output, cacheRead: a.cacheRead + b.cacheRead, cacheWrite: a.cacheWrite + b.cacheWrite };
}

/**
 * Prices in US dollars. They are estimates for the prototype's cost line, not billing data:
 * Deepgram changes its prices often, so check deepgram.com/pricing before relying on them.
 */
export const RATES = {
  /** Deepgram Flux Multilingual streaming, per minute of audio. */
  sttPerMinute: 0.0078,
  /** Deepgram Flux TTS, per 1,000 characters. */
  ttsPer1kChars: 0.045,
  /** Claude Haiku 5.5, per million tokens (prompts up to 100K tokens). Cache reads are 0.1x and 5-minute cache writes 1.25x the input price. */
  haiku: { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  /** Claude Opus 5.5, per million tokens. The report is not cached. */
  opus: { input: 4, output: 20 },
} as const;

export type CostEstimate = {
  sttUsd: number;
  ttsUsd: number;
  llmUsd: number;
  feedbackUsd: number;
  totalUsd: number;
  /** The total scaled to a 30-minute interview. Null when the session was too short to scale. */
  per30MinUsd: number | null;
};

const perMillion = (tokens: number, rate: number) => (tokens / 1_000_000) * rate;

export function estimateCost(usage: Usage, minutes: number): CostEstimate {
  const sttUsd = (usage.sttSeconds / 60) * RATES.sttPerMinute;
  const ttsUsd = (usage.ttsChars / 1000) * RATES.ttsPer1kChars;
  const llmUsd =
    perMillion(usage.llm.input, RATES.haiku.input) +
    perMillion(usage.llm.output, RATES.haiku.output) +
    perMillion(usage.llm.cacheRead, RATES.haiku.cacheRead) +
    perMillion(usage.llm.cacheWrite, RATES.haiku.cacheWrite);
  const feedbackUsd = perMillion(usage.feedback.input, RATES.opus.input) + perMillion(usage.feedback.output, RATES.opus.output);
  const totalUsd = sttUsd + ttsUsd + llmUsd + feedbackUsd;
  return { sttUsd, ttsUsd, llmUsd, feedbackUsd, totalUsd, per30MinUsd: minutes >= 1 ? (totalUsd * 30) / minutes : null };
}

/* ------------------------------------------------------------------ */
/* The block to paste into the Linear issue                            */
/* ------------------------------------------------------------------ */

const usd = (value: number) => `$${value.toFixed(value < 0.1 ? 3 : 2)}`;

export function resultsMarkdown(input: { language: Language; minutes: number; candidateTurns: number; latencies: TurnLatency[]; usage: Usage }): string {
  const summary = summarizeLatency(input.latencies);
  const cost = estimateCost(input.usage, input.minutes);
  const lines = [`**Prototype run** (${input.language.toUpperCase()}, ${input.minutes.toFixed(1)} min, ${input.candidateTurns} candidate turns)`];

  if (summary) {
    lines.push(
      `- Latency, last word to first audio: avg ${summary.avgMs} ms, p50 ${summary.p50Ms}, p90 ${summary.p90Ms}, max ${summary.maxMs}. Under 1 s: ${summary.under1s}/${summary.count}. Within 2 s: ${summary.under2s}/${summary.count}.`,
      `  - Average parts: turn detection ${summary.avg.detectMs} ms, Claude first text ${summary.avg.modelMs}, first sentence ${summary.avg.sentenceMs}, voice ${summary.avg.voiceMs}.`,
    );
  } else {
    lines.push("- Latency: no candidate turn was answered, so nothing was measured.");
  }

  lines.push(
    cost.per30MinUsd === null
      ? `- Cost of this run: ${usd(cost.totalUsd)} (too short to scale to 30 min).`
      : `- Estimated cost for 30 min: ${usd(cost.per30MinUsd)} (this run ${usd(cost.totalUsd)}: speech recognition ${usd(cost.sttUsd)}, voice ${usd(cost.ttsUsd)}, Claude live turns ${usd(cost.llmUsd)}, feedback report ${usd(cost.feedbackUsd)}). Rates are estimates.`,
    "- Transcription quality: _fill in_.",
    '- Verdict, "is the experience good enough?": _fill in_.',
  );
  return lines.join("\n");
}
