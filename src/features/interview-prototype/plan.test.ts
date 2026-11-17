import { describe, expect, it } from "vitest";

import { arrangePlan } from "./plan";
import { AREAS, type PlanDraft } from "./schemas";

const question = (topic: PlanDraft["questions"][number]["topic"], text = `A question about ${topic}.`) => ({ topic, question: text, lookFor: "Specifics." });
const draft = (questions: PlanDraft["questions"]): PlanDraft => ({ roleTitle: "Engineer", companyName: null, questions });

describe("arrangePlan", () => {
  it("keeps a plan that already has one question per area, in order", () => {
    const plan = draft(AREAS.map((area) => question(area)));
    expect(arrangePlan(plan)).toEqual(plan);
  });

  it("puts the questions back in the order of the areas", () => {
    const arranged = arrangePlan(draft([...AREAS].reverse().map((area) => question(area))));
    expect(arranged?.questions.map((q) => q.topic)).toEqual([...AREAS]);
    expect(arranged?.questions[0]?.topic).toBe("Career path");
  });

  it("keeps the first question when an area got more than one", () => {
    const arranged = arrangePlan(draft([...AREAS.map((area) => question(area)), question("Deep dive", "A second deep dive.")]));
    expect(arranged?.questions).toHaveLength(AREAS.length);
    expect(arranged?.questions[3]?.question).toBe("A question about Deep dive.");
  });

  it("refuses a plan that misses an area", () => {
    expect(arrangePlan(draft(AREAS.filter((area) => area !== "Motivation").map((area) => question(area))))).toBeNull();
    expect(arrangePlan(draft([]))).toBeNull();
  });
});
