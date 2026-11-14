import { afterEach, describe, expect, it, vi } from "vitest";

import { appHref, sessionCookieDomain, siteHref, siteUrl } from "@/lib/app-url";

afterEach(() => vi.unstubAllEnvs());

describe("split hosts", () => {
  const split = () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://rows.so");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.rows.so/");
  };

  it("links across hosts with absolute URLs", () => {
    split();
    expect(appHref("/sign-in")).toBe("https://app.rows.so/sign-in");
    expect(siteHref("/in/@ada")).toBe("https://rows.so/in/@ada");
  });

  it("shares the session cookie with the site", () => {
    split();
    expect(sessionCookieDomain()).toBe("rows.so");
  });

  it("shares the cookie when the site is configured with www", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.rows.so");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.rows.so");
    expect(sessionCookieDomain()).toBe("rows.so");
  });

  it("does not share the cookie with an unrelated domain", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://rows.so");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com");
    expect(sessionCookieDomain()).toBeUndefined();
  });
});

describe("one host", () => {
  it("keeps links relative and the cookie host-only", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined as unknown as string);

    expect(siteUrl()).toBe("http://localhost:3000");
    expect(appHref("/sign-in")).toBe("/sign-in");
    expect(siteHref("/pricing")).toBe("/pricing");
    expect(sessionCookieDomain()).toBeUndefined();
  });
});
