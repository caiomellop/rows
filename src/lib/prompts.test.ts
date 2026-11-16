import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { loadPrompt, renderPrompt } from "@/lib/prompts";

const placeholders = (text: string) => new Set([...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]));

describe("prompts", () => {
  it("fills each placeholder once and does not re-read the inserted text", () => {
    expect(renderPrompt("A {{x}} and {{y}}.", { x: "{{y}}", y: "2" })).toBe("A {{y}} and 2.");
  });

  it("fails when a placeholder has no value", () => {
    expect(() => renderPrompt("Hello {{name}}", {})).toThrow("{{name}}");
  });

  it("keeps the interview prompts and the code in step", () => {
    expect(placeholders(loadPrompt("interviews", "interviewer"))).toEqual(new Set(["language_name", "job_description", "resume", "plan"]));
    expect(placeholders(loadPrompt("interviews", "planner"))).toEqual(new Set(["question_count", "language_name"]));
    expect(placeholders(loadPrompt("interviews", "feedback"))).toEqual(new Set(["language_name"]));
    // The page text is added by the code as data after the instructions, so the prompt has no placeholder.
    expect(placeholders(loadPrompt("interviews", "job-extractor"))).toEqual(new Set());
  });
});
