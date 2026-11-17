import { describe, expect, it } from "vitest";

import { AREAS, type InterviewState, type Plan } from "./schemas";
import {
  addTurn,
  allowedMoves,
  applyMove,
  coerceMove,
  describeState,
  FOLLOW_UPS_BY_AREA,
  MAX_CANDIDATE_QUESTIONS,
  MAX_REPEATS,
  prepareTurn,
  remainingMs,
  startState,
  WRAP_UP_AT_MS,
} from "./state";

const plan: Plan = {
  language: "en",
  roleTitle: "Backend Engineer",
  companyName: "Acme",
  questions: [
    { topic: "Career path", question: "Walk me through your career so far.", lookFor: "Relevant experience and why this role." },
    { topic: "Role responsibilities", question: "How do you design a public API?", lookFor: "Versioning, errors, trade-offs." },
    { topic: "Previous roles", question: "What did your team at Globex own?", lookFor: "Company, scope and team." },
    { topic: "Deep dive", question: "Tell me about an outage you handled.", lookFor: "Their own role, the decision and the result." },
    { topic: "Motivation", question: "Why are you looking for something new?", lookFor: "A clear reason tied to this role." },
    { topic: "Salary expectations", question: "What is your current situation regarding salary?", lookFor: "Their current situation; the expectation comes next." },
  ],
};
const BUDGET = 15 * 60_000;

/** The opening and the first-question turns, both heard: the interview is on planned question 1. */
const onQuestion1 = () => applyMove(applyMove(startState(BUDGET), "NEXT", plan), "NEXT", plan);
/** On the planned question of area `index`. */
const onArea = (index: number) => {
  let state = onQuestion1();
  for (let i = 0; i < index; i += 1) state = applyMove(state, "NEXT", plan);
  return state;
};
const onLastQuestion = () => onArea(plan.questions.length - 1);
/** Uses every follow-up the current area allows. */
const exhaust = (state: InterviewState) => {
  let next = state;
  while (allowedMoves(next, plan).includes("FOLLOW_UP")) next = applyMove(next, "FOLLOW_UP", plan);
  return next;
};

describe("interview state machine", () => {
  it("starts in the opening stage with the whole budget", () => {
    const state = startState(BUDGET);
    expect(state).toMatchObject({ stage: "opening", questionIndex: 0, followUps: 0, repeats: 0, areaStartTurn: 0, elapsedMs: 0, budgetMs: BUDGET, transcript: [] });
    expect(remainingMs(state)).toBe(BUDGET);
  });

  it("opens in two turns: the introduction, then planned question 1", () => {
    const opening = prepareTurn(startState(BUDGET), plan, 0);
    expect(allowedMoves(opening, plan)).toEqual(["NEXT"]);
    expect(describeState(opening, plan)).toContain("Do not ask planned question 1 yet.");

    const first = prepareTurn(applyMove(opening, "NEXT", plan), plan, 20_000);
    expect(first).toMatchObject({ stage: "firstQuestion", questionIndex: 0, followUps: 0 });
    expect(allowedMoves(first, plan)).toEqual(["NEXT"]);
    expect(describeState(first, plan)).toContain('ask planned question 1 (Career path): "Walk me through your career so far."');

    expect(applyMove(first, "NEXT", plan)).toMatchObject({ stage: "questions", questionIndex: 0, followUps: 0 });
  });

  it("allows each area only its own number of follow-ups", () => {
    plan.questions.forEach((question, index) => {
      const done = exhaust(onArea(index));
      expect(done.followUps).toBe(FOLLOW_UPS_BY_AREA[question.topic]);
      expect(allowedMoves(done, plan)).toEqual(["REPEAT", "NEXT"]);
    });
    expect(exhaust(onQuestion1()).followUps).toBe(1);
    expect(describeState(exhaust(onQuestion1()), plan)).toContain("This area has had all its follow-ups. Move on with [[NEXT]].");
  });

  it("never lets an area go past 3 questions", () => {
    for (const area of AREAS) expect(1 + FOLLOW_UPS_BY_AREA[area]).toBeLessThanOrEqual(3);
  });

  it("moves to the next area when the limit is hit, even if the model tries to follow up", () => {
    const done = exhaust(onArea(3));
    const move = coerceMove("FOLLOW_UP", allowedMoves(done, plan));
    expect(move).toBe("NEXT");
    expect(applyMove(done, move, plan)).toMatchObject({ stage: "questions", questionIndex: 4, followUps: 0 });
  });

  it("does not count a repeat as a follow-up, and caps repeats", () => {
    let state = onArea(1);
    for (let i = 0; i < MAX_REPEATS; i += 1) {
      expect(allowedMoves(state, plan)).toContain("REPEAT");
      state = applyMove(state, "REPEAT", plan);
    }
    expect(state).toMatchObject({ followUps: 0, repeats: MAX_REPEATS });
    expect(allowedMoves(state, plan)).toEqual(["FOLLOW_UP", "NEXT"]);
    // Past the cap a repeat spends a follow-up, and once those are gone the interview moves on.
    expect(coerceMove("REPEAT", allowedMoves(state, plan))).toBe("FOLLOW_UP");
    expect(coerceMove("REPEAT", allowedMoves(exhaust(state), plan))).toBe("NEXT");
  });

  it("stops follow-ups when the time left only covers one question per remaining area", () => {
    // Career path has 5 areas after it: a follow-up needs 6 minutes plus the wrap-up left.
    const enough = prepareTurn(onQuestion1(), plan, BUDGET - WRAP_UP_AT_MS - 6 * 60_000);
    expect(allowedMoves(enough, plan)).toContain("FOLLOW_UP");

    const short = prepareTurn(onQuestion1(), plan, BUDGET - WRAP_UP_AT_MS - 6 * 60_000 + 1000);
    expect(allowedMoves(short, plan)).toEqual(["REPEAT", "NEXT"]);
    expect(describeState(short, plan)).toContain("Time is short: no more follow-ups");

    // The same time is plenty on the last area.
    const last = prepareTurn(onLastQuestion(), plan, BUDGET - WRAP_UP_AT_MS - 6 * 60_000 + 1000);
    expect(allowedMoves(last, plan)).toContain("FOLLOW_UP");
  });

  it("moves to the next question and resets the counts", () => {
    let state = applyMove(applyMove(onQuestion1(), "FOLLOW_UP", plan), "REPEAT", plan);
    state = applyMove(state, "NEXT", plan);
    expect(state).toMatchObject({ questionIndex: 1, followUps: 0, repeats: 0 });
  });

  it("after the last planned question, NEXT opens the candidate's questions", () => {
    const last = onLastQuestion();
    expect(last.questionIndex).toBe(5);
    expect(allowedMoves(last, plan)).toEqual(["FOLLOW_UP", "REPEAT", "NEXT"]);
    expect(describeState(last, plan)).toContain("[[NEXT]] means: ask the candidate if they have any questions for you");

    const questions = applyMove(applyMove(last, "FOLLOW_UP", plan), "NEXT", plan);
    expect(questions).toMatchObject({ stage: "candidateQuestions", questionIndex: 5, followUps: 0 });
    expect(allowedMoves(questions, plan)).toEqual(["FOLLOW_UP", "END"]);
    expect(describeState(questions, plan)).toContain("answer briefly using only <job_description>");
  });

  it("answers a few of the candidate's questions, then closes", () => {
    let state = applyMove(onLastQuestion(), "NEXT", plan);
    for (let i = 0; i < MAX_CANDIDATE_QUESTIONS; i += 1) state = applyMove(prepareTurn(state, plan, 60_000), "FOLLOW_UP", plan);
    const closing = prepareTurn(state, plan, 60_000);
    expect(closing.stage).toBe("closing");
    expect(allowedMoves(closing, plan)).toEqual(["END"]);
    expect(applyMove(closing, "END", plan).stage).toBe("done");
  });

  it("closes when the time is nearly up", () => {
    const late = prepareTurn(onQuestion1(), plan, BUDGET - WRAP_UP_AT_MS);
    expect(late.stage).toBe("closing");
    expect(allowedMoves(late, plan)).toEqual(["END"]);
    expect(describeState(late, plan)).toContain("Close the interview now");
  });

  it("ends the interview on END", () => {
    const state = applyMove(applyMove(onLastQuestion(), "NEXT", plan), "END", plan);
    expect(state.stage).toBe("done");
  });

  it("never lets a model slip break the plan", () => {
    const state = prepareTurn(onQuestion1(), plan, 1000);
    const allowed = allowedMoves(state, plan);
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
    expect(brief).toContain('Current question (1 of 6, area: Career path): "Walk me through your career so far."');
    expect(brief).toContain("Follow-ups already asked in this area: 0 (maximum 1)");
    expect(brief).toContain('Next planned question (2 of 6, area: Role responsibilities): "How do you design a public API?"');
    expect(brief).toContain("opens a new area (Role responsibilities)");
    expect(brief).toContain("Pace: 6 planned questions left including this one, about 2:09 each.");
    expect(brief).toContain("Allowed moves now: [[FOLLOW_UP]], [[REPEAT]], [[NEXT]]");
    expect(brief).not.toContain("Areas already covered");
  });

  it("lists what was already said in the current area and the areas already covered", () => {
    let state = addTurn(startState(BUDGET), { role: "interviewer", text: "Hi, I'm Sienna. Does that sound good?", at: 1 });
    state = applyMove(state, "NEXT", plan);
    state = addTurn(state, { role: "candidate", text: "Sure.", at: 5 });
    state = applyMove(addTurn(state, { role: "interviewer", text: "Great. Walk me through your career so far.", at: 6 }), "NEXT", plan);
    state = addTurn(state, { role: "candidate", text: "I started at Globex.", at: 30 });
    state = applyMove(addTurn(state, { role: "interviewer", text: "What made you leave Globex?", at: 31 }), "FOLLOW_UP", plan);

    const inCareer = describeState(prepareTurn(state, plan, 60_000), plan);
    expect(inCareer).toContain('- "Great. Walk me through your career so far."\n- "What made you leave Globex?"');
    expect(inCareer).toContain("Never repeat or rephrase a question from it");
    expect(inCareer).not.toContain("Does that sound good?");

    state = addTurn(state, { role: "candidate", text: "Growth.", at: 50 });
    state = applyMove(addTurn(state, { role: "interviewer", text: "Thanks. How do you design a public API?", at: 51 }), "NEXT", plan);
    const inRole = describeState(prepareTurn(state, plan, 90_000), plan);
    expect(inRole).toContain("Areas already covered, never go back to them: Career path");
    expect(inRole).toContain('- "Thanks. How do you design a public API?"');
    expect(inRole).not.toContain("What made you leave Globex?");
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
