import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";

import type { Experience } from "@/db/schema";

import { ResumeDocument } from "./resume-document";

const job: Experience = {
  id: "e1",
  userId: "u1",
  kind: "work",
  title: "Backend engineer",
  organization: "Acme",
  location: "Lisbon",
  startDate: "2022-03",
  endDate: null,
  current: true,
  bullets: ["Built the billing service"],
  skills: ["Go", "PostgreSQL"],
  source: "manual",
  position: 0,
  createdAt: new Date("2026-01-01"),
};

describe("ResumeDocument", () => {
  it("renders a PDF from a profile and experiences, with no projects or GitHub", async () => {
    const pdf = await renderToBuffer(
      ResumeDocument({
        profile: { displayName: "Ada Lovelace", headline: "Backend engineer", summary: "Builds services.", location: "Lisbon" },
        experiences: [job],
        email: "ada@example.com",
      }),
    );
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("renders with an empty profile", async () => {
    const pdf = await renderToBuffer(
      ResumeDocument({ profile: { displayName: null, headline: null, summary: null, location: null }, experiences: [], email: null }),
    );
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
