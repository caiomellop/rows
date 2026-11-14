import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const canViewProfile = vi.fn();
const verifySessionToken = vi.fn();

vi.mock("@/lib/profile-access", () => ({ canViewProfile: (...a: unknown[]) => canViewProfile(...a) }));
vi.mock("@/lib/session", () => ({
  SESSION_COOKIE: "rows_session",
  verifySessionToken: (...a: unknown[]) => verifySessionToken(...a),
}));

import { proxy } from "@/proxy";

const get = (path: string, cookie?: string, host = "rows.so") =>
  proxy(
    new NextRequest(`https://${host}${path}`, {
      headers: { host, ...(cookie ? { cookie: `rows_session=${cookie}` } : {}) },
    }),
  );

/** NextResponse.next() marks the response with this header. */
const passedThrough = (res: Response) => res.headers.get("x-middleware-next") === "1";

beforeEach(() => {
  canViewProfile.mockReset();
  verifySessionToken.mockReset().mockResolvedValue(null);
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://rows.so");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.rows.so");
});

describe("host routing", () => {
  // Signed in, so the session gate below never gets in the way.
  beforeEach(() => verifySessionToken.mockResolvedValue({ id: "u1" }));

  const location = async (path: string, host: string) => {
    const res = await get(path, undefined, host);
    return res.status === 308 ? res.headers.get("location") : passedThrough(res) ? "served" : `status ${res.status}`;
  };

  it("sends app pages asked for on the site to app.rows.so", async () => {
    expect(await location("/sign-in", "rows.so")).toBe("https://app.rows.so/sign-in");
    expect(await location("/dashboard/projects?x=1", "rows.so")).toBe("https://app.rows.so/dashboard/projects?x=1");
    expect(await location("/onboarding", "rows.so")).toBe("https://app.rows.so/onboarding");
    expect(await location("/chat/abc", "rows.so")).toBe("https://app.rows.so/chat/abc");
    expect(await location("/memory", "rows.so")).toBe("https://app.rows.so/memory");
    expect(await location("/sign-in", "www.rows.so")).toBe("https://app.rows.so/sign-in");
    expect(await location("/pricing", "www.rows.so")).toBe("served");
  });

  it("redirects the old sign-in address, keeping the query", async () => {
    expect(await location("/auth/signin?error=expired", "rows.so")).toBe("https://app.rows.so/sign-in?error=expired");
  });

  it("serves app pages on the app host", async () => {
    for (const path of ["/sign-in", "/sign-in/verify", "/sign-out", "/onboarding", "/dashboard", "/dashboard/profile", "/chat", "/chat/abc", "/memory"]) {
      expect(await location(path, "app.rows.so")).toBe("served");
    }
  });

  it("sends site pages asked for on the app host back to rows.so", async () => {
    expect(await location("/pricing", "app.rows.so")).toBe("https://rows.so/pricing");
    expect(await location("/in/@ada", "app.rows.so")).toBe("https://rows.so/in/@ada");
    expect(await location("/terms", "app.rows.so")).toBe("https://rows.so/terms");
  });

  it("opens the dashboard at the root of the app host", async () => {
    expect(await location("/", "app.rows.so")).toBe("https://app.rows.so/dashboard");
  });

  it("serves site pages on the site, and does not treat look-alike paths as app paths", async () => {
    expect(await location("/", "rows.so")).toBe("served");
    expect(await location("/pricing", "rows.so")).toBe("served");
    expect(await location("/sign-inx", "rows.so")).toBe("served");
  });

  it("serves everything on any other host (previews, localhost)", async () => {
    expect(await location("/dashboard", "rows-git-x.vercel.app")).toBe("served");
    expect(await location("/pricing", "localhost:3000")).toBe("served");
  });

  it("does nothing when both URLs are the same origin", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://rows.so");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://rows.so");
    expect(await location("/dashboard", "rows.so")).toBe("served");
    expect(await location("/sign-in", "rows.so")).toBe("served");
  });
});

describe("session gate", () => {
  const signedInPaths = ["/chat", "/chat/abc", "/memory", "/dashboard", "/dashboard/projects", "/onboarding"];

  it("sends a visitor without a session to the login", async () => {
    for (const path of signedInPaths) {
      const res = await get(path, undefined, "app.rows.so");
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("https://app.rows.so/sign-in");
    }
  });

  it("does the same for an invalid or expired session cookie", async () => {
    const res = await get("/chat", "expired", "app.rows.so");
    expect(verifySessionToken).toHaveBeenCalledWith("expired");
    expect(res.headers.get("location")).toBe("https://app.rows.so/sign-in");
  });

  it("lets a signed-in user through", async () => {
    verifySessionToken.mockResolvedValue({ id: "u1" });
    for (const path of signedInPaths) {
      expect(passedThrough(await get(path, "token", "app.rows.so"))).toBe(true);
    }
  });

  it("leaves the login and the public site open", async () => {
    for (const path of ["/sign-in", "/sign-in/verify", "/sign-out"]) {
      expect(passedThrough(await get(path, undefined, "app.rows.so"))).toBe(true);
    }
    expect(passedThrough(await get("/pricing"))).toBe(true);
    expect(passedThrough(await get("/chatty"))).toBe(true);
  });
});

describe("profile proxy", () => {
  it("lets a viewable profile through, with its sub-routes", async () => {
    canViewProfile.mockResolvedValue(true);

    expect(passedThrough(await get("/in/@ada"))).toBe(true);
    expect(passedThrough(await get("/in/@ada/resume"))).toBe(true);
    expect(canViewProfile).toHaveBeenCalledWith("ada", null);
  });

  it("answers 404 for an unpublished or unknown profile", async () => {
    canViewProfile.mockResolvedValue(false);

    const res = await get("/in/@bob");
    expect(res.status).toBe(404);
    expect(passedThrough(res)).toBe(false);
    expect((await get("/in/@bob/opengraph-image")).status).toBe(404);
  });

  it("passes the signed-in user so the owner can preview", async () => {
    verifySessionToken.mockResolvedValue({ id: "u2" });
    canViewProfile.mockResolvedValue(true);

    await get("/in/@bob", "token");
    expect(verifySessionToken).toHaveBeenCalledWith("token");
    expect(canViewProfile).toHaveBeenCalledWith("bob", "u2");
  });

  it("redirects /in/handle and mixed case to the canonical URL", async () => {
    for (const path of ["/in/ada", "/in/@Ada"]) {
      const res = await get(path);
      expect(res.status).toBe(308);
      expect(res.headers.get("location")).toBe("https://rows.so/in/@ada");
    }
    const sub = await get("/in/Ada/resume?x=1");
    expect(sub.headers.get("location")).toBe("https://rows.so/in/@ada/resume?x=1");
    expect(canViewProfile).not.toHaveBeenCalled();
  });

  it("serves a percent-encoded @ without redirecting", async () => {
    canViewProfile.mockResolvedValue(true);
    expect(passedThrough(await get("/in/%40ada"))).toBe(true);
  });

  it("answers 404 for a malformed handle without touching the database", async () => {
    expect((await get("/in/@a_b")).status).toBe(404);
    expect(canViewProfile).not.toHaveBeenCalled();
  });
});
