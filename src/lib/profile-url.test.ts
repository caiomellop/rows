import { describe, expect, it } from "vitest";

import { isBareHandle, parseHandleSegment, profilePath } from "@/lib/profile-url";

describe("profilePath", () => {
  it("builds /in/@handle", () => {
    expect(profilePath("ada")).toBe("/in/@ada");
  });
});

describe("parseHandleSegment", () => {
  it("reads @handle", () => {
    expect(parseHandleSegment("@ada-lovelace")).toBe("ada-lovelace");
  });

  it("accepts a percent-encoded @ and lowercases", () => {
    expect(parseHandleSegment("%40Ada")).toBe("ada");
  });

  it.each(["ada", "@", "@-ada", "@ada-", "@a_b", "@a/b", "@" + "a".repeat(40), "%E0%A4%A"])(
    "rejects %s",
    (segment) => {
      expect(parseHandleSegment(segment)).toBeNull();
    },
  );
});

describe("isBareHandle", () => {
  it("is true for a handle without the @", () => {
    expect(isBareHandle("Ada")).toBe(true);
    expect(isBareHandle("@ada")).toBe(false);
    expect(isBareHandle("a_b")).toBe(false);
  });
});
