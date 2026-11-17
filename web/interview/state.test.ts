import { describe, expect, it } from "vitest";

import type { Plan } from "./schemas";
import { addTurn, allowedMoves, applyMove, coerceMove, describeState, MAX_CANDIDATE_QUESTIONS, MAX_FOLLOW_UPS, prepareTurn, remainingMs, startState, WRAP_UP_AT_MS } from "./state";

const plan: Plan = {
  language: "en",
  roleTitle: "Backend Engineer",
  companyName: "Acme",
  questions: [
    { topic: "Career path", question: "Walk me through your career so far.", lookFor: "Relevant experience and why this role." },
    { topic: "Role responsibilities", question: "How do you design a public API?", lookFor: "Versioning, errors, trade-offs." },
    { topic: "Role responsibilities", question: "How would you handle an outage in a payments API?", lookFor: "Triage, communication, follow-up." },
    { topic: "Salary expectations", question: "What is your current situation regarding salary?", lookFor: "Their current situation; the expectation comes next." },
  ],
};
const BUDGET = 15 * 60_000;

/** The opening and the first-question turns, both heard: the interview is on planned question 1. */
const onQuestion1 = () => applyMove(applyMove(startState(BUDGET), "NEXT", plan), "NEXT", plan);
/** On the last planned question. */
const onLastQuestion = () => applyMove(applyMove(applyMove(onQuestion1(), "NEXT", plan), "NEXT", plan), "NEXT", plan);

describe("interview state machine", () => {
  it("starts in the opening stage with the whole budget", () => {
    const state = startState(BUDGET);
    expect(state).toMatchObject({ stage: "opening", questionIndex: 0, followUps: 0, elapsedMs: 0, budgetMs: BUDGET, transcript: [] });
    expect(remainingMs(state)).toBe(BUDGET);
  });

  it("opens in two turns: the introduction, then planned question 1", () => {
    const opening = prepareTurn(startState(BUDGET), plan, 0);
    expect(allowedMoves(opening)).toEqual(["NEXT"]);
    expect(describeState(opening, plan)).toContain("Do not ask planned question 1 yet.");

    const first = prepareTurn(applyMove(opening, "NEXT", plan), plan, 20_000);
    expect(first).toMatchObject({ stage: "firstQuestion", questionIndex: 0, followUps: 0 });
    expect(allowedMoves(first)).toEqual(["NEXT"]);
    expect(describeState(first, plan)).toContain('ask planned question 1 (Career path): "Walk me through your career so far."');

    expect(applyMove(first, "NEXT", plan)).toMatchObject({ stage: "questions", questionIndex: 0, followUps: 0 });
  });

  it("counts follow-ups and stops allowing them at the limit", () => {
    let state = onQuestion1();
    for (let i = 0; i < MAX_FOLLOW_UPS; i += 1) {
      expect(allowedMoves(state)).toContain("FOLLOW_UP");
      state = applyMove(state, "FOLLOW_UP", plan);
    }
    expect(state.followUps).toBe(MAX_FOLLOW_UPS);
    expect(allowedMoves(state)).toEqual(["NEXT"]);
  });

  it("moves to the next question and resets the follow-up count", () => {
    let state = applyMove(onQuestion1(), "FOLLOW_UP", plan);
    state = applyMove(state, "NEXT", plan);
    expect(state).toMatchObject({ questionIndex: 1, followUps: 0 });
  });

  it("after the last planned question, NEXT opens the candidate's questions", () => {
    const last = onLastQuestion();
    expect(last.questionIndex).toBe(3);
    expect(allowedMoves(last)).toEqual(["FOLLOW_UP", "NEXT"]);
    expect(describeState(last, plan)).toContain("[[NEXT]] means: ask the candidate if they have any questions for you");

    const questions = applyMove(applyMove(last, "FOLLOW_UP", plan), "NEXT", plan);
    expect(questions).toMatchObject({ stage: "candidateQuestions", questionIndex: 3, followUps: 0 });
    expect(allowedMoves(questions)).toEqual(["FOLLOW_UP", "END"]);
    expect(describeState(questions, plan)).toContain("answer briefly using only <job_description>");
  });

  it("answers a few of the candidate's questions, then closes", () => {
    let state = applyMove(onLastQuestion(), "NEXT", plan);
    for (let i = 0; i < MAX_CANDIDATE_QUESTIONS; i += 1) state = applyMove(prepareTurn(state, plan, 60_000), "FOLLOW_UP", plan);
    const closing = prepareTurn(state, plan, 60_000);
    expect(closing.stage).toBe("closing");
    expect(allowedMoves(closing)).toEqual(["END"]);
    expect(applyMove(closing, "END", plan).stage).toBe("done");
  });

  it("closes when the time is nearly up", () => {
    const late = prepareTurn(onQuestion1(), plan, BUDGET - WRAP_UP_AT_MS);
    expect(late.stage).toBe("closing");
    expect(allowedMoves(late)).toEqual(["END"]);
    expect(describeState(late, plan)).toContain("Close the interview now");
  });

  it("ends the interview on END", () => {
    const state = applyMove(applyMove(onLastQuestion(), "NEXT", plan), "END", plan);
    expect(state.stage).toBe("done");
  });

  it("never lets a model slip break the plan", () => {
    const state = prepareTurn(onQuestion1(), plan, 1000);
    const allowed = allowedMoves(state);
    expect(coerceMove("FOLLOW_UP", allowed)).toBe("FOLLOW_UP");
    expect(coerceMove(null, allowed)).toBe("NEXT");
    expect(coerceMove("END", allowed)).toBe("NEXT");
    expect(coerceMove(null, ["END"])).toBe("END");
  });

  it("briefs the model with the stage, the time, the questions, the pace and the allowed moves", () => {
    const state = prepareTurn(onQuestion1(), plan, 125_000);
    const brief = describeState(state, plan);
    expect(brief).toContain("Stage: questions");
    expect(brief).toContain("Time: 2:05 used of 15:00 (12:55 left)");
    expect(brief).toContain('Current question (1 of 4, area: Career path): "Walk me through your career so far."');
    expect(brief).toContain('Next planned question (2 of 4, area: Role responsibilities): "How do you design a public API?"');
    expect(brief).toContain("Pace: 4 planned questions left including this one, about 3:14 each.");
    expect(brief).toContain("Allowed moves now: [[FOLLOW_UP]], [[NEXT]]");
  });

  it("asks for a bridge only when the next question opens a new area", () => {
    expect(describeState(prepareTurn(onQuestion1(), plan, 1000), plan)).toContain("opens a new area (Role responsibilities)");
    const sameArea = prepareTurn(applyMove(onQuestion1(), "NEXT", plan), plan, 1000);
    expect(describeState(sameArea, plan)).not.toContain("opens a new area");
  });

  it("tells the model when its last turn was cut off", () => {
    let state = prepareTurn(onQuestion1(), plan, 1000);
    state = addTurn(state, { role: "interviewer", text: "Thanks. Now tell me about", at: 5, interrupted: true });
    state = addTurn(state, { role: "candidate", text: "Sorry, one more thing.", at: 6 });
    expect(describeState(state, plan)).toContain("cut off by the candidate");
  });

  it("does not mention an interruption when the last interviewer turn was heard in full", () => {
    let state = prepareTurn(onQuestion1(), plan, 1000);
    state = addTurn(state, { role: "interviewer", text: "Walk me through your career so far.", at: 1 });
    expect(describeState(state, plan)).not.toContain("cut off");
  });
});
