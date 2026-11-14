import { randomBytes } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { decrypt, encrypt } from "@/lib/token-crypto";

const KEY = randomBytes(32).toString("base64");

beforeEach(() => {
  vi.stubEnv("TOKEN_ENCRYPTION_KEY", KEY);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Flip one character of a base64url string to a different valid one. */
function flip(part: string) {
  const i = Math.floor(part.length / 2);
  return part.slice(0, i) + (part[i] === "A" ? "B" : "A") + part.slice(i + 1);
}

function tamper(stored: string, index: 1 | 2 | 3) {
  const parts = stored.split(":");
  parts[index] = flip(parts[index]);
  return parts.join(":");
}

describe("encrypt / decrypt", () => {
  it("round-trips", () => {
    const token = "gho_16C7e42F292c6912E7710c838347Ae178B4a";

    expect(decrypt(encrypt(token))).toBe(token);
  });

  it("round-trips empty and non-ASCII strings", () => {
    expect(decrypt(encrypt(""))).toBe("");
    expect(decrypt(encrypt("tökén-✓"))).toBe("tökén-✓");
  });

  it("stores v1:<iv>:<tag>:<ciphertext> with a 12-byte IV and 16-byte tag", () => {
    const [version, iv, tag, ciphertext] = encrypt("secret").split(":");

    expect(version).toBe("v1");
    expect(Buffer.from(iv, "base64url")).toHaveLength(12);
    expect(Buffer.from(tag, "base64url")).toHaveLength(16);
    expect(ciphertext).toBeTruthy();
  });

  it("never contains the plain text", () => {
    expect(encrypt("super-secret-token")).not.toContain("super-secret-token");
  });

  it("uses a fresh IV each time", () => {
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });

  it.each([
    ["iv", 1],
    ["tag", 2],
    ["ciphertext", 3],
  ] as const)("throws when the %s is tampered with", (_name, index) => {
    expect(() => decrypt(tamper(encrypt("secret"), index))).toThrow();
  });

  it("throws when decrypting with a different key", () => {
    const stored = encrypt("secret");
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", randomBytes(32).toString("base64"));

    expect(() => decrypt(stored)).toThrow();
  });

  it("throws on malformed v1 values", () => {
    expect(() => decrypt("v1:onlytwo")).toThrow(/Malformed/);
    expect(() => decrypt("v1:a:b:c")).toThrow(/Malformed/);
    expect(() => decrypt("v1:a:b:c:d")).toThrow(/Malformed/);
  });

  it("returns legacy plain-text values (no v1: prefix) unchanged", () => {
    expect(decrypt("gho_legacyPlainTextToken")).toBe(
      "gho_legacyPlainTextToken",
    );
  });

  it("legacy values do not need the key", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", "");

    expect(decrypt("gho_legacy")).toBe("gho_legacy");
  });

  it("throws a clear error when the key is missing", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", "");

    expect(() => encrypt("x")).toThrow(/TOKEN_ENCRYPTION_KEY is not set/);
  });

  it("throws when the key is not 32 bytes", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", randomBytes(16).toString("base64"));

    expect(() => encrypt("x")).toThrow(/32 bytes/);
  });
});
