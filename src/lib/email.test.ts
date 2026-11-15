import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { loginEmail } from "@/lib/email";

describe("login email", () => {
  const email = loginEmail("https://app.prepermint.com/sign-in/verify?token=abc");

  it("says Prepermint, not Rows", () => {
    for (const text of [email.subject, email.text, email.html]) {
      expect(text).toContain("Prepermint");
      expect(text).not.toMatch(/\bRows\b/);
    }
  });

  it("carries the link in the text and the html", () => {
    expect(email.text).toContain("https://app.prepermint.com/sign-in/verify?token=abc");
    expect(email.html).toContain('href="https://app.prepermint.com/sign-in/verify?token=abc"');
  });
});
