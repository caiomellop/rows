import { describe, expect, it } from "vitest";

import { isActive, modeFor } from "@/lib/app-mode";

describe("modeFor", () => {
  it("reads the mode from the path", () => {
    expect(modeFor("/chat")).toBe("chat");
    expect(modeFor("/chat/abc")).toBe("chat");
    expect(modeFor("/memory")).toBe("chat");
    expect(modeFor("/dashboard")).toBe("dashboard");
    expect(modeFor("/dashboard/projects")).toBe("dashboard");
  });

  it("does not treat look-alike paths as the dashboard", () => {
    expect(modeFor("/dashboards")).toBe("chat");
  });
});

describe("isActive", () => {
  it("matches a mode's home only exactly", () => {
    expect(isActive("/dashboard", "/dashboard")).toBe(true);
    expect(isActive("/dashboard/profile", "/dashboard")).toBe(false);
    expect(isActive("/chat/abc", "/chat")).toBe(false);
  });

  it("matches other items on their own page and below", () => {
    expect(isActive("/memory", "/memory")).toBe(true);
    expect(isActive("/dashboard/projects/1", "/dashboard/projects")).toBe(true);
    expect(isActive("/chat/abc", "/chat/abc")).toBe(true);
    expect(isActive("/chat/abcd", "/chat/abc")).toBe(false);
  });
});
