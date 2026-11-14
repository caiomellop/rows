/**
 * Discovery dimensions and the opening question.
 *
 * Placeholder until the versioned script (MVP-08, docs/discovery/) and the
 * chat engine (MVP-09) land; they replace this module.
 */
export const DISCOVERY_DIMENSIONS = [
  "Goals",
  "Results delivered",
  "Hidden results",
] as const;

export const FIRST_QUESTION = {
  dimension: DISCOVERY_DIMENSIONS[0],
  text: "What role do you want next, and what kind of team or company would you love to do it at?",
  hint: "Think about level, market and the problems you want to work on. Rough answers are fine. We'll dig into the details together.",
} as const;
