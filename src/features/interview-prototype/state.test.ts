import { describe, expect, it } from "vitest";

import type { Plan } from "./schemas";
import { addTurn, allowedMoves, applyMove, coerceMove, describeState, MAX_FOLLOW_UPS, prepareTurn, remainingMs, startState, WRAP_UP_AT_MS } from "./state";

const plan: Plan = {
  language: "en",
  roleTitle: "Backend Engineer",
  companyName: "Acme",
  questions: [
    { topic: "Background", question: "Walk me through your background.", lookFor: "Relevant experience and why this role." },
    { topic: "APIs", question: "How do you design a public API?", lookFor: "Versioning, errors, trade-offs." },
    { topic: "Conflict", question: "Tell me about a disagreement with a teammate.", lookFor: "Their own role and the outcome." },
  ],
};
const BUDGET = 15 * 60_000;

describe("interview state machine", () => {
  it("starts in the opening stage with the whole budget", () => {
    const state = startState(BUDGET);
    expect(state).toMatchObject({ stage: "opening", questionIndex: 0, followUps: 0, elapsedMs: 0, budgetMs: BUDGET, transcript: [] });
    expect(remainingMs(state)).toBe(BUDGET);
  });

  it("only allows the opening move while opening, and the opening message asks question 1", () => {
    const state = prepareTurn(startState(BUDGET), plan, 0);
    expect(allowedMoves(state, plan)).toEqual(["NEXT"]);
    const next = applyMove(state, "NEXT", plan);
    expect(next).toMatchObject({ stage: "questions", questionIndex: 0, followUps: 0 });
  });

  it("counts follow-ups and stops allowing them at the limit", () => {
    let state = applyMove(startState(BUDGET), "NEXT", plan);
    for (let i = 0; i < MAX_FOLLOW_UPS; i += 1) {
      expect(allowedMoves(state, plan)).toContain("FOLLOW_UP");
      state = applyMove(state, "FOLLOW_UP", plan);
    }
    expect(state.followUps).toBe(MAX_FOLLOW_UPS);
    expect(allowedMoves(state, plan)).toEqual(["NEXT"]);
  });

  it("moves to the next question and resets the follow-up count", () => {
    let state = applyMove(startState(BUDGET), "NEXT", plan);
    state = applyMove(state, "FOLLOW_UP", plan);
    state = applyMove(state, "NEXT", plan);
    expect(state).toMatchObject({ questionIndex: 1, followUps: 0 });
  });

  it("offers END instead of NEXT on the last planned question", () => {
    let state = applyMove(startState(BUDGET), "NEXT", plan);
    state = applyMove(applyMove(state, "NEXT", plan), "NEXT", plan);
    expect(state.questionIndex).toBe(2);
    expect(allowedMoves(state, plan)).toEqual(["FOLLOW_UP", "END"]);
  });

  it("closes when the time is nearly up", () => {
    const state = applyMove(startState(BUDGET), "NEXT", plan);
    const late = prepareTurn(state, plan, BUDGET - WRAP_UP_AT_MS);
    expect(late.stage).toBe("closing");
    expect(allowedMoves(late, plan)).toEqual(["END"]);
    expect(describeState(late, plan)).toContain("Close the interview now");
  });

  it("closes after the follow-up limit on the last question", () => {
    let state = applyMove(startState(BUDGET), "NEXT", plan);
    state = applyMove(applyMove(state, "NEXT", plan), "NEXT", plan);
    for (let i = 0; i < MAX_FOLLOW_UPS; i += 1) state = applyMove(state, "FOLLOW_UP", plan);
    expect(prepareTurn(state, plan, 60_000).stage).toBe("closing");
  });

  it("ends the interview on END", () => {
    const state = applyMove(applyMove(startState(BUDGET), "NEXT", plan), "END", plan);
    expect(state.stage).toBe("done");
  });

  it("never lets a model slip break the plan", () => {
    const state = prepareTurn(applyMove(startState(BUDGET), "NEXT", plan), plan, 1000);
    const allowed = allowedMoves(state, plan);
    expect(coerceMove("FOLLOW_UP", allowed)).toBe("FOLLOW_UP");
    expect(coerceMove(null, allowed)).toBe("NEXT");
    expect(coerceMove("END", allowed)).toBe("NEXT");
    expect(coerceMove(null, ["END"])).toBe("END");
  });

  it("briefs the model with the stage, the time, the questions and the allowed moves", () => {
    const state = prepareTurn(applyMove(startState(BUDGET), "NEXT", plan), plan, 125_000);
    const brief = describeState(state, plan);
    expect(brief).toContain("Stage: questions");
    expect(brief).toContain("Time: 2:05 used of 15:00 (12:55 left)");
    expect(brief).toContain('Current question (1 of 3): "Walk me through your background."');
    expect(brief).toContain('Next planned question (2 of 3): "How do you design a public API?"');
    expect(brief).toContain("Allowed moves now: [[FOLLOW_UP]], [[NEXT]]");
  });

  it("tells the model when its last turn was cut off", () => {
    let state = prepareTurn(applyMove(startState(BUDGET), "NEXT", plan), plan, 1000);
    state = addTurn(state, { role: "interviewer", text: "Thanks. Now tell me about", at: 5, interrupted: true });
    state = addTurn(state, { role: "candidate", text: "Sorry, one more thing.", at: 6 });
    expect(describeState(state, plan)).toContain("cut off by the candidate");
  });

  it("does not mention an interruption when the last interviewer turn was heard in full", () => {
    let state = prepareTurn(applyMove(startState(BUDGET), "NEXT", plan), plan, 1000);
    state = addTurn(state, { role: "interviewer", text: "Walk me through your background.", at: 1 });
    expect(describeState(state, plan)).not.toContain("cut off");
  });
});
