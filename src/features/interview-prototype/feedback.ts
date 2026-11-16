import { CRITERIA, type Feedback, type Plan, type Turn } from "./schemas";

/** The transcript as the feedback model reads it. An interrupted turn is labelled, so it is not read as the whole sentence. */
export function transcriptText(turns: Turn[]): string {
  return turns
    .filter((turn) => turn.text.trim())
    .map((turn) => {
      if (turn.role === "candidate") return `Candidate: ${turn.text.trim()}`;
      return turn.interrupted ? `Interviewer (interrupted, the candidate heard only this): ${turn.text.trim()}` : `Interviewer: ${turn.text.trim()}`;
    })
    .join("\n");
}

export function plannedQuestionsText(plan: Plan): string {
  return plan.questions.map((q, i) => `${i + 1}. [${q.topic}] ${q.question}`).join("\n");
}

/** Keeps the report readable whatever the model returned: integer scores in 1-5, one entry per criterion at most, in rubric order. */
export function normalizeFeedback(feedback: Feedback): Feedback {
  const scores = CRITERIA.flatMap((criterion) => {
    const found = feedback.scores.find((s) => s.criterion === criterion);
    return found ? [{ ...found, score: Math.min(5, Math.max(1, Math.round(found.score))) }] : [];
  });
  return { ...feedback, scores };
}
