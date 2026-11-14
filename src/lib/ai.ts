import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaContentBlockParam, BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { z } from "zod";

import type { AssistantMessage, Experience, GroundedPoint, Profile, Project, ProjectCard } from "@/db/schema";

/**
 * Every AI feature in Rows (product plan §3.2, §3.3, §3.7).
 *
 * The one rule all prompts share: never invent. Cards are grounded in platform
 * data, resume parsing copies what the document says, and the CV interview asks
 * questions instead of making up experience or numbers.
 */

const MODEL = "claude-opus-5-5";
// Server-side refusal fallback: if a safety classifier declines, the API
// re-runs the request on a fallback model inside the same call.
const fallback = () => ({ betas: ["server-side-fallback-2026-07-01"] as Anthropic.AnthropicBeta[], fallbacks: "default" as const });

export class AiError extends Error {}

let client: Anthropic | null = null;

export function aiEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

function anthropic() {
  if (!aiEnabled()) throw new AiError("AI is not configured. Set ANTHROPIC_API_KEY.");
  client ??= new Anthropic();
  return client;
}

/** Structured call: returns the parsed object or throws AiError. */
async function structured<T extends z.ZodType>(opts: {
  schema: T;
  system: string;
  content: BetaContentBlockParam[];
  effort: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<z.infer<T>> {
  try {
    const res = await anthropic().beta.messages.parse({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 16000,
      ...fallback(),
      system: opts.system,
      output_config: { effort: opts.effort, format: betaZodOutputFormat(opts.schema) },
      messages: [{ role: "user", content: opts.content }],
    });
    if (res.stop_reason === "refusal") throw new AiError("The AI declined this request. Try editing the text by hand.");
    if (res.stop_reason === "max_tokens") throw new AiError("The AI response was cut off. Try again with a shorter input.");
    if (!res.parsed_output) throw new AiError("The AI returned an unreadable answer. Try again.");
    return res.parsed_output as z.infer<T>;
  } catch (err) {
    throw toAiError(err);
  }
}

function toAiError(err: unknown): Error {
  if (err instanceof AiError) return err;
  if (err instanceof Anthropic.RateLimitError) return new AiError("The AI is busy right now. Try again in a minute.");
  if (err instanceof Anthropic.AuthenticationError) return new AiError("The AI key is invalid. Check ANTHROPIC_API_KEY.");
  if (err instanceof Anthropic.BadRequestError) return new AiError(`The AI rejected the request: ${err.message}`);
  if (err instanceof Anthropic.APIError) return new AiError(`The AI service failed (${err.status ?? "network"}). Try again.`);
  return err instanceof Error ? err : new Error(String(err));
}

/* ------------------------------------------------------------------ */
/* Project cards (plan §3.2)                                           */
/* ------------------------------------------------------------------ */

const SOURCES = ["readme", "languages", "commits", "dependencies", "description", "topics"] as const;

const CardSchema = z.object({
  whatItIs: z
    .string()
    .describe("One plain-English sentence a non-technical recruiter understands: what the project is and who it's for."),
  highlights: z
    .array(
      z.object({
        text: z.string().describe("One short claim, at most ~20 words, in plain English."),
        source: z.enum(SOURCES).describe("Which piece of the provided data this claim comes from."),
      }),
    )
    .describe("Up to 3 highlights a recruiter would care about. Fewer is better than weak or unsupported ones."),
});

const CARD_SYSTEM = `You write project cards for Rows, a portfolio that recruiters read in 60 seconds.

Your reader is a recruiter who is not an engineer. Translate the project into plain English: what it is, who it's for, and what it shows about the person who built it.

Grounding rule (the most important rule):
- Every claim must come from the data you are given: the README, description, topics, languages, dependency list or commit numbers. Name that source in the highlight's "source" field.
- Never invent users, customers, scale, performance numbers, deployments, team size or business impact. If the README doesn't say it, don't say it.
- Don't praise ("impressive", "robust", "cutting-edge"). State facts.
- If the data is thin, write a short, honest card with fewer highlights.

Style: short sentences, concrete nouns, no jargon a recruiter wouldn't know unless it's a technology name (React, PostgreSQL). Write in English.`;

export async function draftProjectCard(p: Project): Promise<ProjectCard> {
  const languages = Object.entries(p.languages)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)
    .slice(0, 8);

  const facts = [
    `Name: ${p.fullName}`,
    p.description && `Description: ${p.description}`,
    p.topics.length > 0 && `Topics: ${p.topics.join(", ")}`,
    languages.length > 0 && `Languages (by size): ${languages.join(", ")}`,
    p.dependencies.length > 0 && `Dependencies: ${p.dependencies.slice(0, 40).join(", ")}`,
    p.userCommits != null && `Commits by the owner: ${p.userCommits} of ${p.totalCommits ?? "?"} total`,
    p.firstCommitAt && p.lastCommitAt && `Owner's commits span: ${p.firstCommitAt.toISOString().slice(0, 10)} to ${p.lastCommitAt.toISOString().slice(0, 10)}`,
    p.homepage && `Live link: ${p.homepage}`,
    p.hasTests != null && `Has tests: ${p.hasTests ? "yes" : "no"}`,
    p.hasCi != null && `Has CI: ${p.hasCi ? "yes" : "no"}`,
  ]
    .filter(Boolean)
    .join("\n");

  const card = await structured({
    schema: CardSchema,
    system: CARD_SYSTEM,
    effort: "medium",
    content: [
      { type: "text", text: `<project_data>\n${facts}\n</project_data>` },
      { type: "text", text: `<readme>\n${p.readme?.trim() || "(no README)"}\n</readme>` },
      { type: "text", text: "Write the card for this project." },
    ],
  });

  return { whatItIs: card.whatItIs.trim(), highlights: card.highlights.slice(0, 3) as GroundedPoint[] };
}

/* ------------------------------------------------------------------ */
/* Recruiter summary (plan §3.1)                                       */
/* ------------------------------------------------------------------ */

const SummarySchema = z.object({
  headline: z.string().describe('One line, at most ~70 characters, e.g. "Backend engineer · Go & PostgreSQL · 4 yrs".'),
  summary: z.string().describe("Exactly 3 sentences: what they build, at what level, and what they want next."),
});

export async function draftSummary(input: {
  profile: Profile;
  projects: Project[];
  experiences: Experience[];
  stack: { language: string; repos: number }[];
}) {
  const { profile, goals } = { profile: input.profile, goals: input.profile.goals };
  const lines = [
    `Name: ${profile.displayName ?? profile.username}`,
    profile.location && `Location: ${profile.location}`,
    (goals.targetRole || goals.targetLevel || goals.targetMarket) &&
      `Goals: ${[goals.targetLevel, goals.targetRole, goals.targetMarket && `in ${goals.targetMarket}`].filter(Boolean).join(" ")}`,
    profile.openToWork && `Open to work: ${[profile.roleTypes.join(", "), profile.workMode].filter(Boolean).join(", ")}`,
    input.stack.length > 0 && `Languages with evidence: ${input.stack.map((s) => `${s.language} (${s.repos} repos)`).join(", ")}`,
    "",
    "Experience (self-reported):",
    ...input.experiences.map(
      (e) =>
        `- ${e.kind === "education" ? "Education" : "Work"}: ${e.title} at ${e.organization} (${e.startDate ?? "?"} to ${e.current ? "present" : (e.endDate ?? "?")})${e.bullets.length ? `: ${e.bullets.join("; ")}` : ""}`,
    ),
    "",
    "Projects (verified from GitHub):",
    ...input.projects.map((p) => `- ${p.name}: ${p.card?.whatItIs ?? p.description ?? "(no description)"} [role: ${p.role ?? "unknown"}]`),
  ]
    .filter((l) => l !== false && l !== null && l !== undefined)
    .join("\n");

  return structured({
    schema: SummarySchema,
    effort: "medium",
    system: `You write the top of a Rows profile: the part a recruiter reads first.

Write a headline and a 3-sentence summary in plain English, in the third person without pronouns ("Builds…", "Has worked…") or in a neutral voice.
- Sentence 1: what they build and with which core technologies.
- Sentence 2: their level and the strongest evidence (a job, a project).
- Sentence 3: what they're looking for next, from their goals. If no goals are given, describe the kind of role the evidence fits.
Use only the facts given. Never invent years of experience, employers, numbers or seniority that the data doesn't support. No praise words.`,
    content: [{ type: "text", text: `<profile_data>\n${lines}\n</profile_data>` }],
  });
}

/* ------------------------------------------------------------------ */
/* Resume / LinkedIn import (plan §3.3)                                */
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
/* CV interview assistant (plan §3.7)                                  */
/* ------------------------------------------------------------------ */

function interviewContext(profile: Profile, experiences: Experience[], projects: Project[]) {
  const g = profile.goals;
  return [
    `Name: ${profile.displayName ?? profile.username}`,
    `Goals so far: ${[g.targetLevel, g.targetRole, g.targetMarket].filter(Boolean).join(" / ") || "(none yet)"}`,
    "Current experience entries:",
    ...(experiences.length
      ? experiences.map((e) => `- ${e.title} at ${e.organization} (${e.startDate ?? "?"}–${e.current ? "present" : (e.endDate ?? "?")}): ${e.bullets.length} bullets${e.bullets.length ? ` — ${e.bullets.join(" | ")}` : ""}`)
      : ["(none yet)"]),
    "Pinned projects:",
    ...(projects.length ? projects.map((p) => `- ${p.name}: ${p.card?.whatItIs ?? p.description ?? ""}`) : ["(none yet)"]),
  ].join("\n");
}

const INTERVIEW_SYSTEM = `You are the career assistant inside Rows. You help a tech worker turn a weak or empty CV into a strong one by interviewing them.

How you work:
1. Start with goals if they're missing: target role, level and market (country or "remote, international").
2. Then go through their jobs and projects one at a time. Ask concrete questions that pull out evidence: What did you ship? For how many users? What changed after? Which technologies? What was hard?
3. Ask one or two questions per message. Keep messages short (under ~80 words). Be warm and direct.
4. When you have enough for a role, show 2–4 strong CV bullets you'd write from their answers, and ask if they're accurate.

Never invent experience, employers, numbers or results. If an answer is vague, ask a follow-up instead of filling the gap. Numbers only come from what the person told you.

The person can press "Save to my CV" at any time; you don't save anything yourself. Reply in the language the person writes in.`;

export async function interviewReply(input: {
  profile: Profile;
  experiences: Experience[];
  projects: Project[];
  messages: AssistantMessage[];
}): Promise<string> {
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
        { type: "text", text: `<what_rows_knows>\n${interviewContext(input.profile, input.experiences, input.projects)}\n</what_rows_knows>` },
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
