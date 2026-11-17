import type { InterviewState, Move, Plan, Stage, Turn } from "./schemas";

/**
 * The interview state machine. Pure functions only: the browser owns the state,
 * the turn route reads it to brief the model, and the tests exercise every transition.
 *
 * opening ──▶ firstQuestion ──▶ questions ──(plan done)──▶ candidateQuestions ──(END)──▶ done
 *                                   └──────(time low)──────▶ closing ──(END)──▶ done
 *
 * The opening introduces the interviewer and the structure and waits for the candidate; planned
 * question 1 comes in the next turn (CAI-91).
 */

/** Follow-ups the interviewer may ask on one planned question. */
export const MAX_FOLLOW_UPS = 2;
/** Questions of the candidate the interviewer answers at the end before it must close. */
export const MAX_CANDIDATE_QUESTIONS = 3;
/** With this little time left the interviewer stops opening questions and closes. */
export const WRAP_UP_AT_MS = 90_000;
/** Extra time after the budget before the app asks for the closing turn by itself. */
export const OVERTIME_GRACE_MS = 30_000;

export function startState(budgetMs: number): InterviewState {
  return { stage: "opening", questionIndex: 0, followUps: 0, elapsedMs: 0, budgetMs, transcript: [] };
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

export function allowedMoves(state: InterviewState): Move[] {
  switch (state.stage) {
    case "opening":
    case "firstQuestion":
      return ["NEXT"];
    case "questions":
      // NEXT on the last planned question opens the candidate's questions.
      return state.followUps < MAX_FOLLOW_UPS ? ["FOLLOW_UP", "NEXT"] : ["NEXT"];
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
  return allowed.includes("NEXT") ? "NEXT" : (allowed[0] ?? "END");
}

/**
 * Record a turn that the candidate heard to the end. A turn that was cut off does not
 * move the interview forward: the candidate may not have heard the question.
 */
export function applyMove(state: InterviewState, move: Move, plan: Plan): InterviewState {
  if (state.stage === "opening") return { ...state, stage: "firstQuestion", questionIndex: 0, followUps: 0 };
  if (state.stage === "firstQuestion") return { ...state, stage: "questions", questionIndex: 0, followUps: 0 };
  switch (move) {
    case "FOLLOW_UP":
      return { ...state, followUps: state.followUps + 1 };
    case "NEXT":
      if (state.questionIndex >= plan.questions.length - 1) return { ...state, stage: "candidateQuestions", followUps: 0 };
      return { ...state, stage: "questions", questionIndex: state.questionIndex + 1, followUps: 0 };
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
    lines.push(
      `Current question (${state.questionIndex + 1} of ${total}, area: ${current.topic}): "${current.question}"`,
      `A strong answer contains: ${current.lookFor}`,
      `Follow-ups already asked on this question: ${state.followUps} (maximum ${MAX_FOLLOW_UPS})`,
    );
    if (next) {
      lines.push(`Next planned question (${state.questionIndex + 2} of ${total}, area: ${next.topic}): "${next.question}"`);
      if (next.topic !== current.topic) lines.push(`The next question opens a new area (${next.topic}): if you move on, bridge to it with one short sentence first.`);
    } else {
      lines.push("This is the last planned question. When it is covered, [[NEXT]] means: ask the candidate if they have any questions for you.");
    }
    const left = total - state.questionIndex;
    lines.push(`Pace: ${left} planned question${left === 1 ? "" : "s"} left including this one, about ${formatClock(remainingMs(state) / left)} each.`);
  }

  lines.push(`Allowed moves now: ${allowedMoves(state).map((m) => `[[${m}]]`).join(", ")}`);

  if (lastInterviewerTurn(state)?.interrupted) {
    lines.push("Your previous turn was cut off by the candidate. They heard only the text shown for it. Do not assume they heard the rest.");
  }
  return lines.join("\n");
}
