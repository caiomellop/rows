import { afterEach, describe, expect, it, vi } from "vitest";

import { appHref, legacyHostTarget, sessionCookieDomain, siteUrl } from "@/lib/app-url";

afterEach(() => vi.unstubAllEnvs());

describe("split hosts", () => {
  const split = () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://prepermint.com");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.prepermint.com/");
  };

  it("links across hosts with absolute URLs", () => {
    split();
    expect(appHref("/sign-in")).toBe("https://app.prepermint.com/sign-in");
  });

  it("shares the session cookie with the site", () => {
    split();
    expect(sessionCookieDomain()).toBe("prepermint.com");
  });

  it("shares the cookie when the site is configured with www", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.prepermint.com");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.prepermint.com");
    expect(sessionCookieDomain()).toBe("prepermint.com");
  });

  it("does not share the cookie with an unrelated domain", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://prepermint.com");
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
    expect(sessionCookieDomain()).toBeUndefined();
  });
});

describe("old rows.so hosts", () => {
  const renamed = () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://prepermint.com");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.prepermint.com");
  };

  it("point to the same path on the new hosts", () => {
    renamed();
    expect(legacyHostTarget("app.rows.so", "/chat")).toBe("https://app.prepermint.com/chat");
    expect(legacyHostTarget("rows.so", "/pricing")).toBe("https://prepermint.com/pricing");
    expect(legacyHostTarget("www.rows.so", "/terms")).toBe("https://prepermint.com/terms");
    expect(legacyHostTarget("rows.so", "/dashboard")).toBe("https://app.prepermint.com/dashboard");
  });

  it("ignore the port and unrelated hosts", () => {
    renamed();
    expect(legacyHostTarget("app.rows.so:443", "/chat")).toBe("https://app.prepermint.com/chat");
    expect(legacyHostTarget("prepermint.com", "/pricing")).toBeNull();
    expect(legacyHostTarget("localhost:3000", "/chat")).toBeNull();
    expect(legacyHostTarget(null, "/chat")).toBeNull();
  });

  it("do not redirect while the environment still names them", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://rows.so");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.rows.so");
    expect(legacyHostTarget("app.rows.so", "/chat")).toBeNull();
  });
});
