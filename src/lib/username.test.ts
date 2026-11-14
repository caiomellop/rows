import { describe, expect, it } from "vitest";

import {
  fallbackUsername,
  isUniqueViolation,
  normalizeUsername,
} from "@/lib/username";

describe("normalizeUsername", () => {
  it("lowercases the GitHub login", () => {
    expect(normalizeUsername("Ada-Lovelace")).toBe("ada-lovelace");
  });
});

describe("fallbackUsername", () => {
  it("appends a short suffix to the lowercased login", () => {
    expect(fallbackUsername("Ada")).toMatch(/^ada-[0-9a-f]{4}$/);
  });
});

describe("isUniqueViolation", () => {
  const violation = (constraint_name: string) => ({
    code: "23505",
    constraint_name,
  });

  it("detects a 23505 error", () => {
    expect(isUniqueViolation(violation("users_username_unique"))).toBe(true);
  });

  it("detects a 23505 error wrapped by drizzle (on `cause`)", () => {
    const wrapped = new Error("Failed query", {
      cause: violation("users_username_unique"),
    });

    expect(isUniqueViolation(wrapped, "users_username_unique")).toBe(true);
  });

  it("only matches the requested constraint", () => {
    expect(
      isUniqueViolation(violation("other_unique"), "users_username_unique"),
    ).toBe(false);
  });

  it("ignores other errors", () => {
    expect(isUniqueViolation(new Error("boom"))).toBe(false);
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation("23505")).toBe(false);
  });
});
