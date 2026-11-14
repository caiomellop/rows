import { describe, expect, it } from "vitest";

import {
  LOGIN_LINK_TTL_MS,
  MAX_REQUESTS_PER_EMAIL,
  MAX_REQUESTS_PER_IP,
  generateLoginToken,
  hashToken,
  isRateLimited,
  isValidEmail,
  loginTokenStatus,
  normalizeEmail,
} from "@/lib/login-token";

describe("generateLoginToken", () => {
  it("returns 32 random bytes and stores only their SHA-256", () => {
    const { token, tokenHash } = generateLoginToken();

    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).toBe(hashToken(token));
    expect(tokenHash).not.toContain(token);
  });

  it("never repeats", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateLoginToken().token));
    expect(tokens.size).toBe(50);
  });
});

describe("hashToken", () => {
  it("is the SHA-256 hex digest", () => {
    expect(hashToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("loginTokenStatus", () => {
  const now = new Date("2026-11-14T12:00:00Z");
  const issued = (minutesAgo: number, usedAt: Date | null = null) => ({
    expiresAt: new Date(now.getTime() - minutesAgo * 60_000 + LOGIN_LINK_TTL_MS),
    usedAt,
  });

  it("is valid for 15 minutes", () => {
    expect(loginTokenStatus(issued(0), now)).toBe("valid");
    expect(loginTokenStatus(issued(14), now)).toBe("valid");
  });

  it("expires at 15 minutes", () => {
    expect(loginTokenStatus(issued(15), now)).toBe("expired");
    expect(loginTokenStatus(issued(60), now)).toBe("expired");
  });

  it("works only once", () => {
    expect(loginTokenStatus(issued(1, new Date(now.getTime() - 1000)), now)).toBe("used");
  });

  it("does not know a token that was never issued", () => {
    expect(loginTokenStatus(null, now)).toBe("unknown");
  });
});

describe("isRateLimited", () => {
  it("allows up to 3 requests per email and 10 per IP", () => {
    expect(isRateLimited({ byEmail: MAX_REQUESTS_PER_EMAIL - 1, byIp: MAX_REQUESTS_PER_IP - 1 })).toBe(false);
  });

  it("blocks the 4th request for an email", () => {
    expect(isRateLimited({ byEmail: MAX_REQUESTS_PER_EMAIL, byIp: 0 })).toBe(true);
  });

  it("blocks the 11th request from an IP", () => {
    expect(isRateLimited({ byEmail: 0, byIp: MAX_REQUESTS_PER_IP })).toBe(true);
  });
});

describe("email", () => {
  it("normalizes with trim and lowercase", () => {
    expect(normalizeEmail("  Caio@Rows.SO ")).toBe("caio@rows.so");
  });

  it.each(["caio@rows.so", "a.b+tag@sub.example.com"])("accepts %s", (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  it.each(["caio@", "caio", "@rows.so", "caio@rows", "a b@rows.so", ""])("rejects %s", (email) => {
    expect(isValidEmail(email)).toBe(false);
  });
});
