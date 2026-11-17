import { describe, expect, it } from "vitest";

import { normalizeFeedback, plannedQuestionsText, transcriptText } from "./feedback";
import type { Feedback, Plan } from "./schemas";

describe("feedback helpers", () => {
  it("labels who spoke and marks an interrupted interviewer turn", () => {
    const text = transcriptText([
      { role: "interviewer", text: "Walk me through your background.", at: 1 },
      { role: "candidate", text: "Um, I have, uh, five years in backend.", at: 9 },
      { role: "interviewer", text: "Thanks. Now tell me about", at: 20, interrupted: true },
      { role: "candidate", text: "  ", at: 22 },
    ]);
    expect(text).toBe(
      ["Interviewer: Walk me through your background.", "Candidate: Um, I have, uh, five years in backend.", "Interviewer (interrupted, the candidate heard only this): Thanks. Now tell me about"].join("\n"),
    );
  });

  it("numbers the planned questions", () => {
    const plan: Plan = { language: "en", roleTitle: "Engineer", companyName: null, questions: [{ topic: "Career path", question: "Tell me about yourself.", lookFor: "x" }] };
    expect(plannedQuestionsText(plan)).toBe("1. [Career path] Tell me about yourself.");
  });

  it("clamps scores to whole numbers from 1 to 5 and puts the criteria in rubric order", () => {
    const report: Feedback = {
      summary: "ok",
      strengths: ["a"],
      improvements: ["b"],
      scores: [
        { criterion: "roleFit", score: 7, note: "n" },
        { criterion: "relevance", score: 3.6, note: "n" },
        { criterion: "structure", score: 0, note: "n" },
        { criterion: "relevance", score: 1, note: "duplicate is ignored" },
      ],
    };
    expect(normalizeFeedback(report).scores.map((s) => [s.criterion, s.score])).toEqual([
      ["relevance", 4],
      ["structure", 1],
      ["roleFit", 5],
    ]);
  });
});
