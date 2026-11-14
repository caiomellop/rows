import { randomBytes } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

/** Rows passed to db.insert(...).values(...) and db.update(...).set(...). */
const inserts: Record<string, unknown>[] = [];
const updates: Record<string, unknown>[] = [];
let existingAccount: { userId: string }[] = [];

const tx = {
  select: () => ({
    from: () => ({ where: () => ({ limit: async () => existingAccount }) }),
  }),
  insert: () => ({
    values: async (row: Record<string, unknown>) => void inserts.push(row),
  }),
  update: () => ({
    set: (row: Record<string, unknown>) => {
      updates.push(row);
      return { where: async () => undefined };
    },
  }),
};

vi.mock("@/db", () => ({
  db: {
    transaction: (run: (t: typeof tx) => Promise<unknown>) => run(tx),
  },
}));

import { upsertGithubUser } from "@/lib/github-oauth";
import { decrypt } from "@/lib/token-crypto";

const input = {
  profile: { id: 1, login: "Ada", name: "Ada", email: null, avatar_url: null },
  email: null,
  accessToken: "gho_plain_access_token",
};

beforeEach(() => {
  inserts.length = 0;
  updates.length = 0;
  existingAccount = [];
  vi.stubEnv("TOKEN_ENCRYPTION_KEY", randomBytes(32).toString("base64"));
});

describe("upsertGithubUser token storage", () => {
  it("encrypts the access token for a new user", async () => {
    await upsertGithubUser(input);

    const account = inserts.find((row) => "access_token" in row);
    expect(account?.access_token).toMatch(/^v1:/);
    expect(account?.access_token).not.toContain("gho_plain_access_token");
    expect(decrypt(account?.access_token as string)).toBe(
      "gho_plain_access_token",
    );
  });

  it("encrypts the access token for an existing user", async () => {
    existingAccount = [{ userId: "user-1" }];

    await upsertGithubUser(input);

    const account = updates.find((row) => "access_token" in row);
    expect(account?.access_token).toMatch(/^v1:/);
    expect(decrypt(account?.access_token as string)).toBe(
      "gho_plain_access_token",
    );
  });

  it("fails the login instead of storing a plain-text token when the key is missing", async () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", "");

    await expect(upsertGithubUser(input)).rejects.toThrow(
      /TOKEN_ENCRYPTION_KEY/,
    );
    // Nothing written at all.
    expect(inserts).toEqual([]);
    expect(updates).toEqual([]);
  });
});
