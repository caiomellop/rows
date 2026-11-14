import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieStore.get(name);
      return value === undefined ? undefined : { name, value };
    },
  }),
}));

import { getSession, signSessionToken } from "@/lib/session";

const user = {
  id: "user-1",
  name: "Ada Lovelace",
  email: "ada@example.com",
  image: "https://example.com/ada.png",
};

beforeEach(() => {
  cookieStore.clear();
  // Cover both the current key and the fallback key (see T3).
  vi.stubEnv("SESSION_SECRET", "test-session-secret-0123456789abcdef");
  vi.stubEnv("AUTH_GITHUB_SECRET", "test-session-secret-0123456789abcdef");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("session token", () => {
  it("round-trips: sign then verify returns the same user", async () => {
    cookieStore.set("rows_session", await signSessionToken(user));

    expect(await getSession()).toEqual(user);
  });

  it("returns null when there is no session cookie", async () => {
    expect(await getSession()).toBeNull();
  });

  it("returns null for a tampered token", async () => {
    const [header, , signature] = (await signSessionToken(user)).split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ ...user, id: "someone-else" }),
    ).toString("base64url");
    cookieStore.set("rows_session", `${header}.${forgedPayload}.${signature}`);

    expect(await getSession()).toBeNull();
  });

  it("returns null for a token signed with a different secret", async () => {
    const token = await signSessionToken(user);
    vi.stubEnv("SESSION_SECRET", "a-completely-different-secret-value!!");
    vi.stubEnv("AUTH_GITHUB_SECRET", "a-completely-different-secret-value!!");
    cookieStore.set("rows_session", token);

    expect(await getSession()).toBeNull();
  });

  it("returns null for an expired token", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    cookieStore.set("rows_session", await signSessionToken(user));

    vi.setSystemTime(new Date("2026-01-30T23:59:00Z"));
    expect(await getSession()).toEqual(user); // still inside the 30d window

    vi.setSystemTime(new Date("2026-02-01T00:00:00Z"));
    expect(await getSession()).toBeNull();
  });
});
