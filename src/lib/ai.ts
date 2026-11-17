import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaContentBlockParam, BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { z } from "zod";

import type { AssistantMessage, Experience, Profile } from "@/db/schema";
import { normalizeFeedback, plannedQuestionsText, transcriptText } from "@/features/interview-prototype/feedback";
import { pageForModel, type Page } from "@/features/interview-prototype/job-posting";
import { LANGUAGE_NAMES, type Language } from "@/features/interview-prototype/languages";
import type { LlmUsage } from "@/features/interview-prototype/metrics";
import { FeedbackSchema, JobSchema, PlanDraftSchema, type Feedback, type Job, type Plan, type PlanDraft, type Turn } from "@/features/interview-prototype/schemas";
import { loadPrompt, renderPrompt } from "@/lib/prompts";

/**
 * Every AI feature in Prepermint: the summary draft, resume import and the CV interview.
 *
 * The one rule all prompts share: never invent. Resume parsing copies what the
 * document says, and the CV interview asks questions instead of making up
 * experience or numbers.
 */

const MODEL = "claude-opus-5-5";
// The voice interview prototype (CAI-36) has about 500 ms between the end of the candidate's answer and the first
// word of the reply, so its live turns and its question plan run on the small model with thinking off.
// The feedback report has no such pressure and uses MODEL.
const INTERVIEW_MODEL = "claude-haiku-5-5";
// Server-side refusal fallback: if a safety classifier declines, the API
// re-runs the request on a fallback model inside the same call.
const fallback = () => ({ betas: ["server-side-fallback-2026-07-01"] as Anthropic.AnthropicBeta[], fallbacks: "default" as const });

export class AiError extends Error {}

let client: Anthropic | null = null;

export function aiEnabled() {
  return Boolean(process.env.ANTHROPIC_KEYS || process.env.ANTHROPIC_AUTH_TOKEN);
}

function anthropic() {
  if (!aiEnabled()) throw new AiError("AI is not configured. Set ANTHROPIC_KEYS.");
  // The key lives in ANTHROPIC_KEYS, not the SDK's default variable name, so it is passed in.
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_KEYS?.trim() || undefined });
  return client;
}

type StructuredOptions<T extends z.ZodType> = {
  schema: T;
  system: string;
  content: BetaContentBlockParam[];
  effort: "low" | "medium" | "high";
  maxTokens?: number;
  /** Defaults to MODEL. */
  model?: string;
};

function toLlmUsage(usage: { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null }): LlmUsage {
  return { input: usage.input_tokens, output: usage.output_tokens, cacheRead: usage.cache_read_input_tokens ?? 0, cacheWrite: usage.cache_creation_input_tokens ?? 0 };
}

/** Structured call: returns the parsed object and what it cost in tokens, or throws AiError. */
async function structuredWithUsage<T extends z.ZodType>(opts: StructuredOptions<T>): Promise<{ parsed: z.infer<T>; usage: LlmUsage }> {
  const model = opts.model ?? MODEL;
  try {
    const res = await anthropic().beta.messages.parse({
      model,
      max_tokens: opts.maxTokens ?? 16000,
      // The refusal fallback is for the main model. The small interview model has none and runs without thinking.
      ...(model === MODEL ? fallback() : { thinking: { type: "disabled" as const } }),
      system: opts.system,
      output_config: { effort: opts.effort, format: betaZodOutputFormat(opts.schema) },
      messages: [{ role: "user", content: opts.content }],
    });
    if (res.stop_reason === "refusal") throw new AiError("The AI declined this request. Try editing the text by hand.");
    if (res.stop_reason === "max_tokens") throw new AiError("The AI response was cut off. Try again with a shorter input.");
    if (!res.parsed_output) throw new AiError("The AI returned an unreadable answer. Try again.");
    return { parsed: res.parsed_output as z.infer<T>, usage: toLlmUsage(res.usage) };
  } catch (err) {
    throw toAiError(err);
  }
}

/** Structured call: returns the parsed object or throws AiError. */
async function structured<T extends z.ZodType>(opts: StructuredOptions<T>): Promise<z.infer<T>> {
  return (await structuredWithUsage(opts)).parsed;
}

function toAiError(err: unknown): Error {
  if (err instanceof AiError) return err;
  if (err instanceof Anthropic.RateLimitError) return new AiError("The AI is busy right now. Try again in a minute.");
  if (err instanceof Anthropic.AuthenticationError) return new AiError("The AI key is invalid. Check ANTHROPIC_KEYS.");
  if (err instanceof Anthropic.BadRequestError) return new AiError(`The AI rejected the request: ${err.message}`);
  if (err instanceof Anthropic.APIError) return new AiError(`The AI service failed (${err.status ?? "network"}). Try again.`);
  return err instanceof Error ? err : new Error(String(err));
}

/* ------------------------------------------------------------------ */
/* Recruiter summary                                                   */
/* ------------------------------------------------------------------ */

const SummarySchema = z.object({
  headline: z.string().describe('One line, at most ~70 characters, e.g. "Backend engineer · Go & PostgreSQL · 4 yrs".'),
  summary: z.string().describe("Exactly 3 sentences: what they build, at what level, and what they want next."),
});

export async function draftSummary(input: { profile: Profile; experiences: Experience[] }) {
  const { profile, goals } = { profile: input.profile, goals: input.profile.goals };
  const lines = [
    profile.displayName && `Name: ${profile.displayName}`,
    profile.location && `Location: ${profile.location}`,
    (goals.targetRole || goals.targetLevel || goals.targetMarket) &&
      `Goals: ${[goals.targetLevel, goals.targetRole, goals.targetMarket && `in ${goals.targetMarket}`].filter(Boolean).join(" ")}`,
    (profile.roleTypes.length > 0 || profile.workMode) &&
      `Looking for: ${[profile.roleTypes.join(", "), profile.workMode].filter(Boolean).join(", ")}`,
    "",
    "Experience (self-reported):",
    ...input.experiences.map(
      (e) =>
        `- ${e.kind === "education" ? "Education" : "Work"}: ${e.title} at ${e.organization} (${e.startDate ?? "?"} to ${e.current ? "present" : (e.endDate ?? "?")})${e.bullets.length ? `: ${e.bullets.join("; ")}` : ""}`,
    ),
  ]
    .filter((l): l is string => typeof l === "string")
    .join("\n");

  return structured({
    schema: SummarySchema,
    effort: "medium",
    system: `You write the top of a Prepermint profile: the part a recruiter reads first.

Write a headline and a 3-sentence summary in plain English, in the third person without pronouns ("Builds…", "Has worked…") or in a neutral voice.
- Sentence 1: what they build and with which core technologies.
- Sentence 2: their level and the strongest evidence (a job).
- Sentence 3: what they're looking for next, from their goals. If no goals are given, describe the kind of role the evidence fits.
Use only the facts given. Never invent years of experience, employers, numbers or seniority that the data doesn't support. No praise words.`,
    content: [{ type: "text", text: `<profile_data>\n${lines}\n</profile_data>` }],
  });
}

/* ------------------------------------------------------------------ */
/* Resume / LinkedIn import                                            */
/* ------------------------------------------------------------------ */

const ExperienceSchema = z.object({
  kind: z.enum(["work", "education"]),
  title: z.string().describe("Job title, or degree/course for education."),
  organization: z.string().describe("Company, or school for education."),
  location: z.string().nullable(),
  startDate: z.string().nullable().describe('"YYYY-MM" when the month is known, else "YYYY". Null if absent.'),
  endDate: z.string().nullable().describe('Same format. Null when current or absent.'),
  current: z.boolean(),
  bullets: z.array(z.string()).describe("Achievements and responsibilities, copied or lightly tightened from the document. Never add facts."),
  skills: z.array(z.string()).describe("Technologies or skills named for this role."),
});

const ResumeSchema = z.object({
  displayName: z.string().nullable(),
  headline: z.string().nullable().describe("The person's own headline or current title, if the document has one."),
  location: z.string().nullable(),
  experiences: z.array(ExperienceSchema).describe("Every job and education entry, most recent first."),
});

export type ParsedResume = z.infer<typeof ResumeSchema>;

export async function parseResume(file: { kind: "pdf"; base64: string } | { kind: "text"; text: string }): Promise<ParsedResume> {
  const document: BetaContentBlockParam =
    file.kind === "pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: file.base64 } }
      : { type: "document", source: { type: "text", media_type: "text/plain", data: file.text } };

  return structured({
    schema: ResumeSchema,
    effort: "low",
    system: `You extract a person's career history from their resume or LinkedIn profile export into structured data.
Copy what the document says. Don't infer, embellish or add achievements. Keep bullets close to the original wording; you may fix obvious typos and split run-on sentences. If a field is missing, use null.`,
    content: [document, { type: "text", text: "Extract the career history from this document." }],
  });
}

/* ------------------------------------------------------------------ */
/* CV interview assistant                                             */
/* ------------------------------------------------------------------ */

function interviewContext(profile: Profile, experiences: Experience[]) {
  const g = profile.goals;
  return [
    `Name: ${profile.displayName ?? "(unknown)"}`,
    `Goals so far: ${[g.targetLevel, g.targetRole, g.targetMarket].filter(Boolean).join(" / ") || "(none yet)"}`,
    "Current experience entries:",
    ...(experiences.length
      ? experiences.map((e) => `- ${e.title} at ${e.organization} (${e.startDate ?? "?"}–${e.current ? "present" : (e.endDate ?? "?")}): ${e.bullets.length} bullets${e.bullets.length ? ` — ${e.bullets.join(" | ")}` : ""}`)
      : ["(none yet)"]),
  ].join("\n");
}

const INTERVIEW_SYSTEM = `You are the career assistant inside Prepermint. You help a tech worker turn a weak or empty CV into a strong one by interviewing them.

How you work:
1. Start with goals if they're missing: target role, level and market (country or "remote, international").
2. Then go through their jobs one at a time. Ask concrete questions that pull out evidence: What did you ship? For how many users? What changed after? Which technologies? What was hard?
3. Ask one or two questions per message. Keep messages short (under ~80 words). Be warm and direct.
4. When you have enough for a role, show 2–4 strong CV bullets you'd write from their answers, and ask if they're accurate.

Never invent experience, employers, numbers or results. If an answer is vague, ask a follow-up instead of filling the gap. Numbers only come from what the person told you.

The person can press "Save to my CV" at any time; you don't save anything yourself. Reply in the language the person writes in.`;

export async function interviewReply(input: { profile: Profile; experiences: Experience[]; messages: AssistantMessage[] }): Promise<string> {
  const history: BetaMessageParam[] = input.messages.map((m) => ({ role: m.role, content: m.content }));
  if (history.length === 0 || history[0].role !== "user") {
    history.unshift({ role: "user", content: "Hi! Help me build my CV." });
  }

  try {
    const res = await anthropic().beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      ...fallback(),
      output_config: { effort: "medium" },
      system: [
        { type: "text", text: INTERVIEW_SYSTEM },
        { type: "text", text: `<what_rows_knows>\n${interviewContext(input.profile, input.experiences)}\n</what_rows_knows>` },
      ],
      messages: history,
    });
    if (res.stop_reason === "refusal") throw new AiError("The assistant declined to answer that. Try rephrasing.");
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
    if (!text) throw new AiError("The assistant returned an empty answer. Try again.");
    return text;
  } catch (err) {
    throw toAiError(err);
  }
}

const InterviewExtractSchema = z.object({
  goals: z.object({
    targetRole: z.string().nullable(),
    targetLevel: z.string().nullable(),
    targetMarket: z.string().nullable(),
  }),
  experiences: z
    .array(ExperienceSchema)
    .describe("Only roles the person discussed. Bullets only from facts they stated or confirmed."),
});

export type InterviewExtract = z.infer<typeof InterviewExtractSchema>;

export async function extractFromInterview(messages: AssistantMessage[]): Promise<InterviewExtract> {
  const transcript = messages.map((m) => `${m.role === "user" ? "Candidate" : "Assistant"}: ${m.content}`).join("\n\n");
  return structured({
    schema: InterviewExtractSchema,
    effort: "medium",
    system: `You turn a CV interview transcript into structured CV data.
Write strong, concise CV bullets (action verb first, result where the candidate gave one) in English.
Use only facts the candidate stated or confirmed. Suggestions the assistant made that the candidate did not confirm don't count. Never invent numbers. If a field is unknown, use null.`,
    content: [{ type: "text", text: `<transcript>\n${transcript}\n</transcript>` }],
  });
}

/* ------------------------------------------------------------------ */
/* Voice interview prototype (CAI-36)                                  */
/* ------------------------------------------------------------------ */

/** The question plan, built from the job description and the resume summary and written in the interview's language. */
export async function planInterview(input: { jobDescription: string; resume: string; language: Language }): Promise<{ plan: PlanDraft; usage: LlmUsage }> {
  const { parsed, usage } = await structuredWithUsage({
    schema: PlanDraftSchema,
    model: INTERVIEW_MODEL,
    effort: "low",
    maxTokens: 3000,
    system: renderPrompt(loadPrompt("interviews", "planner"), { language_name: LANGUAGE_NAMES[input.language] }),
    content: [{ type: "text", text: `<job_description>\n${input.jobDescription}\n</job_description>\n\n<resume>\n${input.resume || "(none provided)"}\n</resume>` }],
  });
  return { plan: parsed, usage };
}

/**
 * Reads a scraped job page and keeps only what a job interview needs: the role, the work and the
 * requirements. It says so when the page is not one specific posting.
 */
export async function extractJob(page: Page): Promise<{ job: Job; usage: LlmUsage }> {
  const { parsed, usage } = await structuredWithUsage({
    schema: JobSchema,
    model: INTERVIEW_MODEL,
    effort: "low",
    maxTokens: 3000,
    system: loadPrompt("interviews", "job-extractor"),
    content: [{ type: "text", text: pageForModel(page) }],
  });
  return { job: parsed, usage };
}

export type InterviewerEvent = { type: "text"; text: string } | { type: "done"; usage: LlmUsage };

/**
 * One spoken turn of the interviewer, streamed. No thinking, lowest effort and a cached briefing keep
 * the time to the first token short. Aborting `signal` stops the model, so a barge-in stops the spending too.
 */
export async function* streamInterviewerTurn(input: { system: string; messages: Anthropic.MessageParam[]; signal?: AbortSignal }): AsyncGenerator<InterviewerEvent> {
  try {
    const stream = anthropic().messages.stream(
      {
        model: INTERVIEW_MODEL,
        max_tokens: 400,
        thinking: { type: "disabled" },
        output_config: { effort: "low" },
        system: [{ type: "text", text: input.system, cache_control: { type: "ephemeral" } }],
        messages: input.messages,
      },
      { signal: input.signal },
    );
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield { type: "text", text: event.delta.text };
    }
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") throw new AiError("The interviewer declined to continue. End the interview and try again.");
    yield { type: "done", usage: toLlmUsage(message.usage) };
  } catch (err) {
    throw toAiError(err);
  }
}

/** The feedback report: the whole transcript and a scoring rubric. It runs after the interview, off the real-time path. */
export async function interviewFeedback(input: { jobDescription: string; plan: Plan; transcript: Turn[] }): Promise<{ feedback: Feedback; usage: LlmUsage }> {
  const { parsed, usage } = await structuredWithUsage({
    schema: FeedbackSchema,
    effort: "medium",
    maxTokens: 4000,
    system: renderPrompt(loadPrompt("interviews", "feedback"), { language_name: LANGUAGE_NAMES[input.plan.language] }),
    content: [
      {
        type: "text",
        text: [
          `<job_description>\n${input.jobDescription}\n</job_description>`,
          `<planned_questions>\n${plannedQuestionsText(input.plan)}\n</planned_questions>`,
          `<transcript>\n${transcriptText(input.transcript)}\n</transcript>`,
        ].join("\n\n"),
      },
    ],
  });
  return { feedback: normalizeFeedback(parsed), usage };
}
