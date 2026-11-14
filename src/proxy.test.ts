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

const get = (path: string, cookie?: string) =>
  proxy(
    new NextRequest(`https://rows.so${path}`, cookie ? { headers: { cookie: `rows_session=${cookie}` } } : undefined),
  );

/** NextResponse.next() marks the response with this header. */
const passedThrough = (res: Response) => res.headers.get("x-middleware-next") === "1";

beforeEach(() => {
  canViewProfile.mockReset();
  verifySessionToken.mockReset().mockResolvedValue(null);
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
