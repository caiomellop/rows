import type { Area, InterviewState, Move, Plan, Stage, Turn } from "./schemas";

/**
 * The interview state machine. Pure functions only: the browser owns the state,
 * the turn route reads it to brief the model, and the tests exercise every transition.
 *
 * opening ──▶ firstQuestion ──▶ questions ──(plan done)──▶ candidateQuestions ──(END)──▶ done
 *                                   └──────(time low)──────▶ closing ──(END)──▶ done
 *
 * The opening introduces the interviewer and the structure and waits for the candidate; planned
 * question 1 comes in the next turn (CAI-91).
 *
 * The plan has one question per area. The code, not the model, decides when an area is over (CAI-93): the
 * model can only ask the follow-ups its area allows, and only while there is time left for every other area.
 */

/** Follow-ups allowed on each area's planned question. No area goes past 3 questions. */
export const FOLLOW_UPS_BY_AREA: Record<Area, number> = {
  "Career path": 1,
  "Role responsibilities": 2,
  "Previous roles": 2,
  "Deep dive": 2,
  Motivation: 1,
  "Salary expectations": 2,
};
/** Times the planned question may be said again on request. Capped, so repeating can't hold the interview in one area. */
export const MAX_REPEATS = 2;
/** Time kept for each area still to come. Follow-ups stop when the time left only covers these. */
export const AREA_RESERVE_MS = 60_000;
/** Questions of the candidate the interviewer answers at the end before it must close. */
export const MAX_CANDIDATE_QUESTIONS = 3;
/** With this little time left the interviewer stops opening questions and closes. */
export const WRAP_UP_AT_MS = 90_000;
/** Extra time after the budget before the app asks for the closing turn by itself. */
export const OVERTIME_GRACE_MS = 30_000;

export function startState(budgetMs: number): InterviewState {
  return { stage: "opening", questionIndex: 0, followUps: 0, repeats: 0, areaStartTurn: 0, elapsedMs: 0, budgetMs, transcript: [] };
}

export function remainingMs(state: InterviewState): number {
  return Math.max(0, state.budgetMs - state.elapsedMs);
}

export function addTurn(state: InterviewState, turn: Turn): InterviewState {
  return { ...state, transcript: [...state.transcript, turn] };
}

/** The stage the next interviewer turn happens in. Low time, or enough of the candidate's questions, means closing. */
export function stageForNextTurn(state: InterviewState): Stage {
  if (state.stage === "done" || state.stage === "opening" || state.stage === "closing") return state.stage;
  if (remainingMs(state) <= WRAP_UP_AT_MS) return "closing";
  if (state.stage === "candidateQuestions" && state.followUps >= MAX_CANDIDATE_QUESTIONS) return "closing";
  return state.stage;
}

/** Bring the state up to date right before the interviewer speaks. */
export function prepareTurn(state: InterviewState, plan: Plan, elapsedMs: number): InterviewState {
  const withTime = { ...state, elapsedMs };
  return { ...withTime, stage: stageForNextTurn(withTime) };
}

/** Follow-ups the current area allows. */
export function maxFollowUps(state: InterviewState, plan: Plan): number {
  const area = plan.questions[state.questionIndex]?.topic;
  return area ? FOLLOW_UPS_BY_AREA[area] : 0;
}

/** True while one more follow-up still leaves about a minute for every area after this one. */
export function timeAllowsFollowUp(state: InterviewState, plan: Plan): boolean {
  const areasAfter = Math.max(0, plan.questions.length - 1 - state.questionIndex);
  return remainingMs(state) - WRAP_UP_AT_MS >= (areasAfter + 1) * AREA_RESERVE_MS;
}

export function allowedMoves(state: InterviewState, plan: Plan): Move[] {
  switch (state.stage) {
    case "opening":
    case "firstQuestion":
      return ["NEXT"];
    case "questions": {
      // NEXT on the last planned question opens the candidate's questions.
      const moves: Move[] = [];
      if (state.followUps < maxFollowUps(state, plan) && timeAllowsFollowUp(state, plan)) moves.push("FOLLOW_UP");
      if (state.repeats < MAX_REPEATS) moves.push("REPEAT");
      moves.push("NEXT");
      return moves;
    }
    case "candidateQuestions":
      return state.followUps < MAX_CANDIDATE_QUESTIONS ? ["FOLLOW_UP", "END"] : ["END"];
    case "closing":
    case "done":
      return ["END"];
  }
}

/** A model slip (missing or illegal tag) never skips the plan or breaks a limit. */
export function coerceMove(move: Move | null, allowed: Move[]): Move {
  if (move && allowed.includes(move)) return move;
  // A repeat past its cap still keeps the interview in the area, so it spends a follow-up if one is left.
  if (move === "REPEAT" && allowed.includes("FOLLOW_UP")) return "FOLLOW_UP";
  return allowed.includes("NEXT") ? "NEXT" : (allowed[0] ?? "END");
}

/** Where the planned question was asked: the interviewer turn just recorded, if the last turn is one. */
function askedAt(state: InterviewState): number {
  const last = state.transcript.length - 1;
  return state.transcript[last]?.role === "interviewer" ? last : state.transcript.length;
}

/**
 * Record a turn that the candidate heard to the end. A turn that was cut off does not
 * move the interview forward: the candidate may not have heard the question.
 */
export function applyMove(state: InterviewState, move: Move, plan: Plan): InterviewState {
  if (state.stage === "opening") return { ...state, stage: "firstQuestion", questionIndex: 0, followUps: 0, repeats: 0 };
  if (state.stage === "firstQuestion") return { ...state, stage: "questions", questionIndex: 0, followUps: 0, repeats: 0, areaStartTurn: askedAt(state) };
  switch (move) {
    case "FOLLOW_UP":
      return { ...state, followUps: state.followUps + 1 };
    case "REPEAT":
      return { ...state, repeats: state.repeats + 1 };
    case "NEXT":
      if (state.questionIndex >= plan.questions.length - 1) return { ...state, stage: "candidateQuestions", followUps: 0, repeats: 0 };
      return { ...state, stage: "questions", questionIndex: state.questionIndex + 1, followUps: 0, repeats: 0, areaStartTurn: askedAt(state) };
    case "END":
      return { ...state, stage: "done" };
  }
}

/** 125000 -> "2:05". */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function lastInterviewerTurn(state: InterviewState): Turn | undefined {
  return [...state.transcript].reverse().find((t) => t.role === "interviewer");
}

/** The operator briefing for the next interviewer turn. Rebuilt every turn from the state alone. */
export function describeState(state: InterviewState, plan: Plan): string {
  const total = plan.questions.length;
  const current = plan.questions[state.questionIndex];
  const next = plan.questions[state.questionIndex + 1];
  const lines = [`Stage: ${state.stage}`, `Time: ${formatClock(state.elapsedMs)} used of ${formatClock(state.budgetMs)} (${formatClock(remainingMs(state))} left)`];

  if (state.stage === "opening") {
    lines.push(
      'Open the interview as your instructions describe under "Opening", first turn: greet, introduce yourself, explain the structure, and ask if that sounds good.',
      "Do not ask planned question 1 yet.",
    );
  } else if (state.stage === "firstQuestion") {
    lines.push(
      "The candidate has heard your introduction. If they asked or raised something, answer it in one short sentence.",
      `Then move on with a short bridge and ask planned question 1 (${plan.questions[0]?.topic ?? ""}): "${plan.questions[0]?.question ?? ""}"`,
    );
  } else if (state.stage === "candidateQuestions") {
    lines.push(
      "The plan is finished and you asked whether the candidate has any questions for you.",
      "If they asked something, answer briefly using only <job_description>, or say you don't have that information, then ask if there is anything else they would like to know: [[FOLLOW_UP]].",
      "If they have no more questions, close: thank them and say goodbye: [[END]].",
      `Questions of the candidate answered so far: ${state.followUps} (maximum ${MAX_CANDIDATE_QUESTIONS})`,
    );
  } else if (state.stage === "closing" || state.stage === "done") {
    lines.push("Time is nearly up. Close the interview now: if the candidate just asked you something, answer it in one sentence (only from <job_description>), then thank them and say goodbye.");
  } else if (current) {
    const max = maxFollowUps(state, plan);
    lines.push(
      `Current question (${state.questionIndex + 1} of ${total}, area: ${current.topic}): "${current.question}"`,
      `A strong answer contains: ${current.lookFor}`,
      `Follow-ups already asked in this area: ${state.followUps} (maximum ${max})`,
    );
    const covered = plan.questions.slice(0, state.questionIndex).map((q) => q.topic);
    if (covered.length) lines.push(`Areas already covered, never go back to them: ${covered.join(", ")}`);
    const asked = state.transcript.slice(state.areaStartTurn).filter((t) => t.role === "interviewer");
    if (asked.length) {
      lines.push("What you already said in this area. Never repeat or rephrase a question from it unless the candidate asks you to ([[REPEAT]]):", ...asked.map((t) => `- "${t.text.trim()}"`));
    }
    if (state.followUps >= max) lines.push("This area has had all its follow-ups. Move on with [[NEXT]].");
    else if (!timeAllowsFollowUp(state, plan)) lines.push("Time is short: no more follow-ups, so every remaining area still gets its question. Move on with [[NEXT]].");
    if (next) {
      lines.push(`Next planned question (${state.questionIndex + 2} of ${total}, area: ${next.topic}): "${next.question}"`);
      if (next.topic !== current.topic) lines.push(`The next question opens a new area (${next.topic}): if you move on, bridge to it with one short sentence first.`);
    } else {
      lines.push("This is the last planned question. When it is covered, [[NEXT]] means: ask the candidate if they have any questions for you.");
    }
    const left = total - state.questionIndex;
    lines.push(`Pace: ${left} planned question${left === 1 ? "" : "s"} left including this one, about ${formatClock(remainingMs(state) / left)} each.`);
  }

  lines.push(`Allowed moves now: ${allowedMoves(state, plan).map((m) => `[[${m}]]`).join(", ")}`);

  if (lastInterviewerTurn(state)?.interrupted) {
    lines.push("Your previous turn was cut off by the candidate. They heard only the text shown for it. Do not assume they heard the rest.");
  }
  return lines.join("\n");
}
