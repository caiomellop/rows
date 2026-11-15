import { z } from "zod";

/**
 * Structured result of the discovery conversation. The script that produces it
 * is docs/discovery/roteiro.md.
 *
 * Rule shared by every field: nothing here may be invented. Text, numbers and
 * dates come from the candidate's answers or from a document or link they
 * provided. When the candidate does not know something, `scope` / `result`
 * stay `null` instead of being filled with a guess.
 */

const text = z.string().trim().min(1);

export const TARGET_LEVELS = ["intern", "junior", "mid", "senior", "lead", "manager", "director", "executive"] as const;

export const EVIDENCE_KINDS = [
  "stated", // the candidate said it and has no document (weakest)
  "document", // a file the candidate uploaded
  "link", // a public link the candidate gave
  "reference", // a person the candidate named who can confirm it
] as const;

export const Evidence = z.object({
  kind: z.enum(EVIDENCE_KINDS),
  /** What supports the claim: the candidate's own words, a file name, a URL or a person. */
  detail: text,
});

export const Achievement = z.object({
  /** What the candidate did, in the first person. */
  what: text,
  /** Size of it: people, users, money, time. `null` when the candidate did not say. */
  scope: text.nullable(),
  /** What changed, with a number only if the candidate gave it. `null` when unknown. */
  result: text.nullable(),
  evidence: Evidence,
});

/** Something the candidate did but does not call an achievement. */
export const HiddenResult = z.object({
  what: text,
  evidence: Evidence,
});

export const DiscoveryContext = z.object({
  targetRole: text,
  targetLevel: z.enum(TARGET_LEVELS),
  /** Country, city or remote, and working language, as the candidate described it. */
  targetMarket: text,
  goals: z.array(text).min(1),
  achievements: z.array(Achievement),
  hiddenResults: z.array(HiddenResult),
});

export type Evidence = z.infer<typeof Evidence>;
export type Achievement = z.infer<typeof Achievement>;
export type HiddenResult = z.infer<typeof HiddenResult>;
export type DiscoveryContext = z.infer<typeof DiscoveryContext>;
