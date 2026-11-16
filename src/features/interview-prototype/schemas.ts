import { z } from "zod";

import { isPublicJobUrl, MAX_JOB_URL_LENGTH } from "./job-url";
import { DEFAULT_VOICE, LANGUAGES, VOICE_IDS } from "./languages";

/**
 * Types and request schemas of the voice interview prototype (CAI-36).
 * Nothing here is stored: the interview state lives in the browser and travels with each request.
 */

export const DURATIONS = [10, 15, 20, 30] as const;

/** Size limits shared by the form and the routes, so a pasted document can't run up the Claude bill. */
export const LIMITS = { jobDescription: 12_000, resume: 12_000, turnText: 4_000, turns: 200 } as const;

/** What the interviewer can do in one turn. The model writes it as a tag at the start of its reply. */
export const MOVES = ["FOLLOW_UP", "NEXT", "END"] as const;
export type Move = (typeof MOVES)[number];

/* ------------------------------------------------------------------ */
/* Question plan (written by Claude from the job description and CV)   */
/* ------------------------------------------------------------------ */

const PlanQuestionSchema = z.object({
  topic: z.string().describe('Two or three words, e.g. "Team leadership".'),
  question: z.string().describe("Exactly what the interviewer says: one natural spoken sentence."),
  lookFor: z.string().describe("One sentence on what a strong answer contains."),
});

/** What the planner model writes. The language is not its choice: it comes from the voice the candidate picked. */
export const PlanDraftSchema = z.object({
  roleTitle: z.string(),
  companyName: z.string().nullable(),
  questions: z.array(PlanQuestionSchema).describe("The questions, in the order they will be asked."),
});
export type PlanDraft = z.infer<typeof PlanDraftSchema>;

/** The plan that travels with the interview: the draft plus the language the interview is held in. */
export const PlanSchema = PlanDraftSchema.extend({ language: z.enum(LANGUAGES) });
export type Plan = z.infer<typeof PlanSchema>;

/* ------------------------------------------------------------------ */
/* Interview state                                                     */
/* ------------------------------------------------------------------ */

export const TurnSchema = z.object({
  role: z.enum(["interviewer", "candidate"]),
  text: z.string().max(LIMITS.turnText),
  /** Seconds since the interview started. */
  at: z.number().min(0),
  /** The candidate cut the interviewer off: `text` is only the part they heard. */
  interrupted: z.boolean().optional(),
});
export type Turn = z.infer<typeof TurnSchema>;

export const STAGES = ["opening", "questions", "closing", "done"] as const;
export type Stage = (typeof STAGES)[number];

/**
 * The interview state is the product: where the interview is, not only what was said.
 * `questionIndex` is the planned question being discussed (the last one asked).
 */
export const InterviewStateSchema = z.object({
  stage: z.enum(STAGES),
  questionIndex: z.number().int().min(0).max(20),
  followUps: z.number().int().min(0).max(20),
  elapsedMs: z.number().min(0).max(4 * 3_600_000),
  budgetMs: z.number().int().min(60_000).max(3_600_000),
  transcript: z.array(TurnSchema).max(LIMITS.turns),
});
export type InterviewState = z.infer<typeof InterviewStateSchema>;

/* ------------------------------------------------------------------ */
/* Route requests                                                      */
/* ------------------------------------------------------------------ */

const jobDescription = z.string().trim().min(40, "Paste the job description (at least a few lines).").max(LIMITS.jobDescription);
const resume = z.string().trim().max(LIMITS.resume).default("");
// The plan comes back from the browser on later requests, so it is validated and capped again.
const plan = PlanSchema.refine((p) => JSON.stringify(p).length < 20_000, "The plan is too large.");

export const StartRequestSchema = z.object({
  jobDescription,
  resume,
  voice: z.enum(VOICE_IDS).default(DEFAULT_VOICE),
  durationMinutes: z.union(DURATIONS.map((d) => z.literal(d)) as [z.ZodLiteral<10>, z.ZodLiteral<15>, z.ZodLiteral<20>, z.ZodLiteral<30>]),
});

export const TurnRequestSchema = z.object({ jobDescription, resume, plan, state: InterviewStateSchema });

export const FeedbackRequestSchema = z.object({
  jobDescription,
  plan,
  transcript: z.array(TurnSchema).min(1).max(LIMITS.turns),
});

export const JobRequestSchema = z.object({
  url: z.string().trim().max(MAX_JOB_URL_LENGTH).refine(isPublicJobUrl, "That link cannot be read. Paste the public address of the job posting."),
});

/* ------------------------------------------------------------------ */
/* Feedback report (written by Claude after the interview)             */
/* ------------------------------------------------------------------ */

export const CRITERIA = ["relevance", "structure", "specificity", "communication", "roleFit"] as const;

export const FeedbackSchema = z.object({
  summary: z.string().describe("Two or three sentences with the overall impression."),
  scores: z
    .array(
      z.object({
        criterion: z.enum(CRITERIA),
        score: z.number().describe("Integer from 1 to 5."),
        note: z.string().describe("One sentence that points to something the candidate said."),
      }),
    )
    .describe("One entry per criterion."),
  strengths: z.array(z.string()).describe("Two or three items."),
  improvements: z.array(z.string()).describe("Two or three concrete, actionable items."),
});
export type Feedback = z.infer<typeof FeedbackSchema>;

/* ------------------------------------------------------------------ */
/* Job posting read from a link (written by Claude from the page text) */
/* ------------------------------------------------------------------ */

export const JobSchema = z.object({
  isJobPosting: z.boolean().describe("True only if the page describes one specific job and it is the job the link points to."),
  roleTitle: z.string().describe("The job title as written. Empty when isJobPosting is false."),
  companyName: z.string().nullable().describe("The employer, or null if the page does not say."),
  seniority: z.string().nullable().describe("The level (for example Junior, Senior, Staff), only if the posting states it. Otherwise null."),
  responsibilities: z.array(z.string()).describe("What the person will do, one short item each."),
  requirements: z.array(z.string()).describe("The must-haves: skills, experience, education, languages, certifications."),
  niceToHave: z.array(z.string()).describe("What the posting calls preferred, a plus or a differential."),
  tools: z.array(z.string()).describe("Technologies, tools and methods named in the role."),
});
export type Job = z.infer<typeof JobSchema>;

/* ------------------------------------------------------------------ */
/* Route responses (the browser validates what it reads)               */
/* ------------------------------------------------------------------ */

export const LlmUsageSchema = z.object({ input: z.number(), output: z.number(), cacheRead: z.number(), cacheWrite: z.number() });

export const SessionResponseSchema = z.object({
  plan: PlanSchema,
  budgetMs: z.number(),
  usage: LlmUsageSchema,
  deepgram: z.object({ token: z.string(), listenUrl: z.string(), speakUrl: z.string() }),
});
export type SessionResponse = z.infer<typeof SessionResponseSchema>;

/**
 * What reading a job link answers (the Server Action in read-job.ts): the text the interview is built from, the role
 * and company for the form to show, and what the model call cost. A failure carries a message that is safe to show.
 */
export type ReadJobResult =
  | { ok: true; jobDescription: string; roleTitle: string; companyName: string | null; usage: z.infer<typeof LlmUsageSchema> }
  | { ok: false; error: string };

/** One line of the turn route's stream: the move, then the words to speak, then the usage. */
export const TurnEventSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("move"), move: z.enum(MOVES).nullable() }),
  z.object({ t: z.literal("text"), text: z.string() }),
  z.object({ t: z.literal("done"), usage: LlmUsageSchema }),
  z.object({ t: z.literal("error"), message: z.string() }),
]);
export type TurnEvent = z.infer<typeof TurnEventSchema>;

export const FeedbackResponseSchema = z.object({ feedback: FeedbackSchema, usage: LlmUsageSchema });
