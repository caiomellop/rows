import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import { loadPrompt, renderPrompt } from "@/lib/prompts";

import { plannedQuestionsText } from "./feedback";
import { LANGUAGE_NAMES } from "./languages";
import type { InterviewState, Plan } from "./schemas";
import { describeState } from "./state";

const START = "The interview is starting now.";
const SILENCE = "(The candidate has not said anything since.)";

/** Speech never needs angle brackets, and they would let the candidate close our tags. */
const clean = (text: string) => text.replace(/[<>]/g, "").trim();

/**
 * What Claude sees for one interviewer turn. The system prompt is the same on every turn of an
 * interview, so it can be cached. What changes each turn (the state briefing) goes at the end of the
 * last message, after the candidate's words, which stay inside <candidate_said> tags as data.
 */
export function buildTurnPrompt(input: { jobDescription: string; resume: string; plan: Plan; state: InterviewState }): {
  system: string;
  messages: Anthropic.MessageParam[];
} {
  const system = renderPrompt(loadPrompt("interviews", "interviewer"), {
    language_name: LANGUAGE_NAMES[input.plan.language],
    interviewer_name: input.plan.interviewerName ?? "(none)",
    job_description: input.jobDescription,
    resume: input.resume || "(none provided)",
    plan: plannedQuestionsText(input.plan),
  });

  // The API wants alternating roles that start with the user. Neighbours of the same role are joined.
  type Group = { role: "user" | "assistant"; parts: string[] };
  const groups: Group[] = [{ role: "user", parts: [START] }];
  const add = (role: Group["role"], text: string) => {
    const last = groups[groups.length - 1];
    if (last.role === role) last.parts.push(text);
    else groups.push({ role, parts: [text] });
  };

  for (const turn of input.state.transcript) {
    const text = clean(turn.text);
    if (!text) continue;
    if (turn.role === "candidate") add("user", `<candidate_said>${text}</candidate_said>`);
    else add("assistant", turn.interrupted ? `${text} …` : text);
  }

  if (groups[groups.length - 1].role === "assistant") groups.push({ role: "user", parts: [SILENCE] });
  groups[groups.length - 1].parts.push(`<interview_state>\n${describeState(input.state, input.plan)}\n</interview_state>`);

  return {
    system,
    messages: groups.map((group) => ({ role: group.role, content: group.parts.map((text) => ({ type: "text" as const, text })) })),
  };
}
