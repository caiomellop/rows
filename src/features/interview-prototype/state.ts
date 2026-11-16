import type { InterviewState, Move, Plan, Stage, Turn } from "./schemas";

/**
 * The interview state machine. Pure functions only: the browser owns the state,
 * the turn route reads it to brief the model, and the tests exercise every transition.
 *
 * opening ──(opening message heard)──▶ questions ──(time low / plan done)──▶ closing ──(END)──▶ done
 */

/** Follow-ups the interviewer may ask on one planned question. */
export const MAX_FOLLOW_UPS = 2;
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

/** The stage the next interviewer turn happens in. Low time or a finished plan means closing. */
export function stageForNextTurn(state: InterviewState, plan: Plan): Stage {
  if (state.stage === "done" || state.stage === "opening") return state.stage;
  const onLastQuestion = state.questionIndex >= plan.questions.length - 1;
  if (remainingMs(state) <= WRAP_UP_AT_MS) return "closing";
  if (onLastQuestion && state.followUps >= MAX_FOLLOW_UPS) return "closing";
  return "questions";
}

/** Bring the state up to date right before the interviewer speaks. */
export function prepareTurn(state: InterviewState, plan: Plan, elapsedMs: number): InterviewState {
  const withTime = { ...state, elapsedMs };
  return { ...withTime, stage: stageForNextTurn(withTime, plan) };
}

export function allowedMoves(state: InterviewState, plan: Plan): Move[] {
  switch (state.stage) {
    case "opening":
      return ["NEXT"];
    case "closing":
    case "done":
      return ["END"];
    case "questions": {
      const moves: Move[] = [];
      if (state.followUps < MAX_FOLLOW_UPS) moves.push("FOLLOW_UP");
      moves.push(state.questionIndex < plan.questions.length - 1 ? "NEXT" : "END");
      return moves;
    }
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
  if (state.stage === "opening") return { ...state, stage: "questions", questionIndex: 0, followUps: 0 };
  switch (move) {
    case "FOLLOW_UP":
      return { ...state, followUps: state.followUps + 1 };
    case "NEXT":
      return { ...state, stage: "questions", questionIndex: Math.min(state.questionIndex + 1, plan.questions.length - 1), followUps: 0 };
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
      `Open the interview: greet the candidate in one sentence, say it is a short spoken interview for the ${plan.roleTitle} role, then ask planned question 1: "${plan.questions[0]?.question ?? ""}"`,
      "If the candidate has already said something, acknowledge it briefly first.",
    );
  } else if (state.stage === "closing" || state.stage === "done") {
    lines.push("Time is nearly up, or the plan is finished. Close the interview now: thank the candidate and say goodbye.");
  } else if (current) {
    lines.push(
      `Current question (${state.questionIndex + 1} of ${total}): "${current.question}"`,
      `A strong answer contains: ${current.lookFor}`,
      `Follow-ups already asked on this question: ${state.followUps} (maximum ${MAX_FOLLOW_UPS})`,
    );
    if (next) lines.push(`Next planned question (${state.questionIndex + 2} of ${total}): "${next.question}"`);
    else lines.push("This is the last planned question.");
  }

  lines.push(`Allowed moves now: ${allowedMoves(state, plan).map((m) => `[[${m}]]`).join(", ")}`);

  if (lastInterviewerTurn(state)?.interrupted) {
    lines.push("Your previous turn was cut off by the candidate. They heard only the text shown for it. Do not assume they heard the rest.");
  }
  return lines.join("\n");
}
