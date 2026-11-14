import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// github-oauth imports the DB client, which needs DATABASE_URL at import time.
vi.mock("@/db", () => ({ db: {} }));

import { fetchGithubProfile } from "@/lib/github-oauth";

const profile = {
  id: 1,
  login: "ada",
  name: "Ada Lovelace",
  avatar_url: "https://example.com/ada.png",
};

const fetchMock = vi.fn();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

/** Mock GitHub: /user returns `user`, /user/emails returns `emails` (or fails). */
function mockGithub(user: object, emails: object[] | "error") {
  fetchMock.mockImplementation(async (url: string) => {
    if (url === "https://api.github.com/user") return json(user);
    if (url === "https://api.github.com/user/emails") {
      return emails === "error" ? json({ message: "nope" }, 403) : json(emails);
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
}

const calledUrls = () => fetchMock.mock.calls.map(([url]) => url);

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchGithubProfile email picking", () => {
  it("uses the public profile email and skips /user/emails", async () => {
    mockGithub({ ...profile, email: "public@example.com" }, []);

    const result = await fetchGithubProfile("token");

    expect(result.email).toBe("public@example.com");
    expect(calledUrls()).toEqual(["https://api.github.com/user"]);
  });

  it("prefers the primary verified email", async () => {
    mockGithub({ ...profile, email: null }, [
      { email: "other@example.com", primary: false, verified: true },
      { email: "primary@example.com", primary: true, verified: true },
      { email: "unverified@example.com", primary: false, verified: false },
    ]);

    expect((await fetchGithubProfile("token")).email).toBe("primary@example.com");
  });

  it("falls back to any verified email when the primary is unverified", async () => {
    mockGithub({ ...profile, email: null }, [
      { email: "primary@example.com", primary: true, verified: false },
      { email: "verified@example.com", primary: false, verified: true },
    ]);

    expect((await fetchGithubProfile("token")).email).toBe("verified@example.com");
  });

  it("falls back to the first email when none are verified", async () => {
    mockGithub({ ...profile, email: null }, [
      { email: "first@example.com", primary: false, verified: false },
      { email: "second@example.com", primary: true, verified: false },
    ]);

    expect((await fetchGithubProfile("token")).email).toBe("first@example.com");
  });

  it("returns null when the account has no emails", async () => {
    mockGithub({ ...profile, email: null }, []);

    expect((await fetchGithubProfile("token")).email).toBeNull();
  });

  it("returns null when /user/emails fails", async () => {
    mockGithub({ ...profile, email: null }, "error");

    expect((await fetchGithubProfile("token")).email).toBeNull();
  });

  it("sends the access token as a Bearer header", async () => {
    mockGithub({ ...profile, email: "public@example.com" }, []);

    await fetchGithubProfile("secret-token");

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
      "Bearer secret-token",
    );
  });

  it("throws when the /user request fails", async () => {
    fetchMock.mockResolvedValue(json({ message: "Bad credentials" }, 401));

    await expect(fetchGithubProfile("bad")).rejects.toThrow(/401/);
  });
});
