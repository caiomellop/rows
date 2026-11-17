import { AREAS, type PlanDraft } from "./schemas";

/**
 * Puts the planner's questions in the fixed order of the areas, one per area (CAI-93). The order is checked
 * here, not trusted to the model. If an area got more than one question, the first one is kept. Returns
 * null when an area has no question, because an interview must cover all of them.
 */
export function arrangePlan(draft: PlanDraft): PlanDraft | null {
  const questions = AREAS.map((area) => draft.questions.find((q) => q.topic === area));
  if (questions.some((q) => q === undefined)) return null;
  return { ...draft, questions: questions.filter((q) => q !== undefined) };
}
