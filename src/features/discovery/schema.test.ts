import { describe, expect, it } from "vitest";

import { DiscoveryContext } from "./schema";

const valid = {
  targetRole: "Senior Product Designer",
  targetLevel: "senior",
  targetMarket: "Portugal, hybrid, English",
  goals: ["Join a product team that ships weekly"],
  achievements: [
    {
      what: "I redesigned the checkout flow",
      scope: "Team of 4, 120k monthly users",
      result: "Checkout drop-off went from 38% to 29%",
      evidence: { kind: "link", detail: "https://example.com/case-study" },
    },
  ],
  hiddenResults: [
    {
      what: "I wrote the onboarding guide new designers still use",
      evidence: { kind: "stated", detail: "Told me in the discovery chat" },
    },
  ],
};

describe("DiscoveryContext", () => {
  it("accepts a complete context", () => {
    expect(DiscoveryContext.safeParse(valid).success).toBe(true);
  });

  it("accepts an unknown scope and result as null instead of a guess", () => {
    const parsed = DiscoveryContext.safeParse({
      ...valid,
      achievements: [{ ...valid.achievements[0], scope: null, result: null }],
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts an empty hidden results list", () => {
    expect(DiscoveryContext.safeParse({ ...valid, hiddenResults: [] }).success).toBe(true);
  });

  it("rejects an achievement without evidence", () => {
    const withoutEvidence = { ...valid.achievements[0], evidence: undefined };
    expect(DiscoveryContext.safeParse({ ...valid, achievements: [withoutEvidence] }).success).toBe(false);
  });

  it("rejects an achievement with blank evidence", () => {
    const blank = { ...valid.achievements[0], evidence: { kind: "stated", detail: "   " } };
    expect(DiscoveryContext.safeParse({ ...valid, achievements: [blank] }).success).toBe(false);
  });

  it("rejects an unknown evidence kind", () => {
    const bad = { ...valid.achievements[0], evidence: { kind: "guess", detail: "x" } };
    expect(DiscoveryContext.safeParse({ ...valid, achievements: [bad] }).success).toBe(false);
  });

  it("rejects an unknown level", () => {
    expect(DiscoveryContext.safeParse({ ...valid, targetLevel: "wizard" }).success).toBe(false);
  });

  it("requires at least one goal", () => {
    expect(DiscoveryContext.safeParse({ ...valid, goals: [] }).success).toBe(false);
  });

  it.each(["targetRole", "targetMarket"])("rejects a blank %s", (field) => {
    expect(DiscoveryContext.safeParse({ ...valid, [field]: "  " }).success).toBe(false);
  });
});
