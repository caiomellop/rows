import { describe, expect, it } from "vitest";

import { isPublicJobUrl, jobUrlFrom, MAX_JOB_URL_LENGTH } from "./job-url";

describe("telling a link from pasted text", () => {
  it("takes one http or https address, with or without spaces around it", () => {
    expect(jobUrlFrom("https://jobs.lever.co/Flex/151e09c6-398f-4fe0-8da7-8fd7814d1bae")).toBe("https://jobs.lever.co/Flex/151e09c6-398f-4fe0-8da7-8fd7814d1bae");
    expect(jobUrlFrom("  https://boards.greenhouse.io/acme/jobs/123?gh_src=x \n")).toBe("https://boards.greenhouse.io/acme/jobs/123?gh_src=x");
    expect(jobUrlFrom("http://example.com")).toBe("http://example.com/");
  });

  it("treats pasted text as text, even when it contains a link", () => {
    expect(jobUrlFrom("We are hiring. Apply at https://example.com/jobs/1")).toBeNull();
    expect(jobUrlFrom("https://example.com/jobs/1 Senior engineer")).toBeNull();
    expect(jobUrlFrom("")).toBeNull();
    expect(jobUrlFrom("   ")).toBeNull();
  });

  it("does not guess a link without a scheme, and refuses other schemes", () => {
    expect(jobUrlFrom("example.com/jobs/1")).toBeNull();
    expect(jobUrlFrom("Node.js")).toBeNull();
    expect(jobUrlFrom("ftp://example.com/jobs/1")).toBeNull();
    expect(jobUrlFrom("javascript:alert(1)")).toBeNull();
    expect(jobUrlFrom("file:///etc/passwd")).toBeNull();
  });

  it("refuses a link that is too long", () => {
    expect(jobUrlFrom(`https://example.com/${"a".repeat(MAX_JOB_URL_LENGTH)}`)).toBeNull();
  });
});

describe("addresses we are willing to read", () => {
  it.each([
    "https://jobs.lever.co/Flex/151e09c6-398f-4fe0-8da7-8fd7814d1bae",
    "https://job-boards.greenhouse.io/reddit/jobs/8093006",
    "https://verity.gupy.io/jobs/12732278",
    "https://www.linkedin.com/jobs/view/3673087467/",
    "http://careers.example.com/openings?id=7",
    "https://example.com:443/jobs/1",
  ])("accepts %s", (link) => {
    expect(isPublicJobUrl(link)).toBe(true);
  });

  it.each([
    "http://localhost:3000/jobs/1",
    "https://intranet/jobs/1",
    "https://hr.intranet.local/jobs/1",
    "https://jobs.internal/1",
    "http://127.0.0.1/jobs/1",
    "http://10.0.0.5/jobs/1",
    "http://192.168.1.1/admin",
    "http://169.254.169.254/latest/meta-data",
    "http://2130706433/",
    "http://0x7f.0.0.1/",
    "http://[::1]/jobs/1",
    "https://user:secret@example.com/jobs/1",
    "https://example.com:8080/jobs/1",
    "ftp://example.com/jobs/1",
    "not a link",
  ])("refuses %s", (link) => {
    expect(isPublicJobUrl(link)).toBe(false);
  });
});
