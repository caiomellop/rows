import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifySessionToken = vi.fn();

vi.mock("@/lib/session", () => ({
  SESSION_COOKIE: "pp_session",
  verifySessionToken: (...a: unknown[]) => verifySessionToken(...a),
}));

import { proxy } from "@/proxy";

const get = (path: string, cookie?: string, host = "prepermint.com") =>
  proxy(
    new NextRequest(`https://${host}${path}`, {
      headers: { host, ...(cookie ? { cookie: `pp_session=${cookie}` } : {}) },
    }),
  );

/** NextResponse.next() marks the response with this header. */
const passedThrough = (res: Response) => res.headers.get("x-middleware-next") === "1";

beforeEach(() => {
  verifySessionToken.mockReset().mockResolvedValue(null);
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://prepermint.com");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.prepermint.com");
});

describe("host routing", () => {
  // Signed in, so the session gate below never gets in the way.
  beforeEach(() => verifySessionToken.mockResolvedValue({ id: "u1" }));

  const location = async (path: string, host: string) => {
    const res = await get(path, undefined, host);
    return res.status === 308 ? res.headers.get("location") : passedThrough(res) ? "served" : `status ${res.status}`;
  };

  it("sends app pages asked for on the site to app.prepermint.com", async () => {
    expect(await location("/sign-in", "prepermint.com")).toBe("https://app.prepermint.com/sign-in");
    expect(await location("/dashboard/profile?x=1", "prepermint.com")).toBe("https://app.prepermint.com/dashboard/profile?x=1");
    expect(await location("/chat/abc", "prepermint.com")).toBe("https://app.prepermint.com/chat/abc");
    expect(await location("/memory", "prepermint.com")).toBe("https://app.prepermint.com/memory");
    expect(await location("/sign-in", "www.prepermint.com")).toBe("https://app.prepermint.com/sign-in");
    expect(await location("/pricing", "www.prepermint.com")).toBe("served");
  });

  it("redirects the old sign-in address, keeping the query", async () => {
    expect(await location("/auth/signin?error=expired", "prepermint.com")).toBe("https://app.prepermint.com/sign-in?error=expired");
  });

  it("serves app pages on the app host", async () => {
    for (const path of ["/sign-in", "/sign-in/verify", "/sign-out", "/dashboard", "/dashboard/profile", "/chat", "/chat/abc", "/memory"]) {
      expect(await location(path, "app.prepermint.com")).toBe("served");
    }
  });

  it("sends site pages asked for on the app host back to prepermint.com", async () => {
    expect(await location("/pricing", "app.prepermint.com")).toBe("https://prepermint.com/pricing");
    expect(await location("/terms", "app.prepermint.com")).toBe("https://prepermint.com/terms");
  });

  it("opens the chat at the root of the app host", async () => {
    expect(await location("/", "app.prepermint.com")).toBe("https://app.prepermint.com/chat");
  });

  it("serves site pages on the site, and does not treat look-alike paths as app paths", async () => {
    expect(await location("/", "prepermint.com")).toBe("served");
    expect(await location("/pricing", "prepermint.com")).toBe("served");
    expect(await location("/sign-inx", "prepermint.com")).toBe("served");
  });

  it("serves everything on any other host (previews, localhost)", async () => {
    expect(await location("/dashboard", "prepermint-git-x.vercel.app")).toBe("served");
    expect(await location("/pricing", "localhost:3000")).toBe("served");
  });

  it("does nothing when both URLs are the same origin", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://prepermint.com");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://prepermint.com");
    expect(await location("/dashboard", "prepermint.com")).toBe("served");
    expect(await location("/sign-in", "prepermint.com")).toBe("served");
  });
});

describe("session gate", () => {
  const signedInPaths = ["/chat", "/chat/abc", "/memory", "/dashboard", "/dashboard/experience"];

  it("sends a visitor without a session to the login", async () => {
    for (const path of signedInPaths) {
      const res = await get(path, undefined, "app.prepermint.com");
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("https://app.prepermint.com/sign-in");
    }
  });

  it("does the same for an invalid or expired session cookie", async () => {
    const res = await get("/chat", "expired", "app.prepermint.com");
    expect(verifySessionToken).toHaveBeenCalledWith("expired");
    expect(res.headers.get("location")).toBe("https://app.prepermint.com/sign-in");
  });

  it("lets a signed-in user through", async () => {
    verifySessionToken.mockResolvedValue({ id: "u1" });
    for (const path of signedInPaths) {
      expect(passedThrough(await get(path, "token", "app.prepermint.com"))).toBe(true);
    }
  });

  it("leaves the login and the public site open", async () => {
    for (const path of ["/sign-in", "/sign-in/verify", "/sign-out"]) {
      expect(passedThrough(await get(path, undefined, "app.prepermint.com"))).toBe(true);
    }
    expect(passedThrough(await get("/pricing"))).toBe(true);
    expect(passedThrough(await get("/chatty"))).toBe(true);
  });
});

describe("old rows.so hosts after the rename", () => {
  const redirect = async (path: string, host: string) => {
    const res = await get(path, undefined, host);
    return res.status === 308 ? res.headers.get("location") : passedThrough(res) ? "served" : `status ${res.status}`;
  };

  it("sends an old app link to the same path on app.prepermint.com", async () => {
    expect(await redirect("/chat", "app.rows.so")).toBe("https://app.prepermint.com/chat");
    expect(await redirect("/chat/abc?x=1", "app.rows.so")).toBe("https://app.prepermint.com/chat/abc?x=1");
    expect(await redirect("/sign-in/verify?token=t", "app.rows.so")).toBe("https://app.prepermint.com/sign-in/verify?token=t");
  });

  it("sends old site links to prepermint.com, and app pages on the old site to the app", async () => {
    expect(await redirect("/pricing", "rows.so")).toBe("https://prepermint.com/pricing");
    expect(await redirect("/", "www.rows.so")).toBe("https://prepermint.com/");
    expect(await redirect("/sign-in", "rows.so")).toBe("https://app.prepermint.com/sign-in");
  });

  it("does not redirect while the configured URLs still point at the old hosts", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://rows.so");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.rows.so");
    expect(await redirect("/pricing", "rows.so")).toBe("served");
    expect(await redirect("/sign-in", "app.rows.so")).toBe("served");
  });
});
