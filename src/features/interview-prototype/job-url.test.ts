import { describe, expect, it } from "vitest";

import { INVALID_LINK_MESSAGE, isPublicJobUrl, jobUrlFrom, LOOKS_LIKE_TEXT_MESSAGE, MAX_JOB_URL_LENGTH, parseJobUrlInput } from "./job-url";

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

describe("the Job posting URL field", () => {
  const lever = "https://jobs.lever.co/Flex/151e09c6-398f-4fe0-8da7-8fd7814d1bae";

  it("is empty for nothing or only spaces", () => {
    expect(parseJobUrlInput("")).toEqual({ state: "empty" });
    expect(parseJobUrlInput("  \n ")).toEqual({ state: "empty" });
  });

  it("accepts a full link as it is", () => {
    expect(parseJobUrlInput(lever)).toEqual({ state: "valid", url: lever });
    expect(parseJobUrlInput(`  ${lever}\n`)).toEqual({ state: "valid", url: lever });
  });

  it("adds https:// to a link written without it", () => {
    expect(parseJobUrlInput("www.linkedin.com/jobs/view/4480371955")).toEqual({ state: "valid", url: "https://www.linkedin.com/jobs/view/4480371955" });
    expect(parseJobUrlInput("jobs.lever.co/Flex/151e09c6")).toEqual({ state: "valid", url: "https://jobs.lever.co/Flex/151e09c6" });
    expect(parseJobUrlInput("www.example.com")).toEqual({ state: "valid", url: "https://www.example.com/" });
  });

  it("takes the address out of a share text", () => {
    expect(parseJobUrlInput("Check out this job at Certara: https://www.linkedin.com/jobs/view/4480371955")).toEqual({
      state: "valid",
      url: "https://www.linkedin.com/jobs/view/4480371955",
    });
    expect(parseJobUrlInput("Look at this (https://jobs.lever.co/Flex/1).")).toEqual({ state: "valid", url: "https://jobs.lever.co/Flex/1" });
    expect(parseJobUrlInput("Vaga na Gupy: verity.gupy.io/jobs/12732278 corre!")).toEqual({ state: "valid", url: "https://verity.gupy.io/jobs/12732278" });
  });

  it("does not take a technology or an abbreviation for a link", () => {
    for (const text of ["Node.js", "e.g.", "Vue.js and Next.js", "linkedin.com", "hello"]) expect(parseJobUrlInput(text)).toEqual({ state: "invalid", message: INVALID_LINK_MESSAGE });
  });

  it("refuses addresses we do not read", () => {
    for (const text of ["http://localhost:3000/vaga", "https://192.168.0.10/vaga", "https://user:pw@example.com/job", "ftp://example.com/job", "https://example.com:8080/job", "isto não é um link"]) {
      expect(parseJobUrlInput(text)).toEqual({ state: "invalid", message: INVALID_LINK_MESSAGE });
    }
  });

  it("tells the text of a posting from a link, even when the text mentions an address", () => {
    const posting = `We are hiring a backend engineer. ${"You will build payment APIs in Go. ".repeat(30)} Apply at https://example.com/jobs/1`;
    expect(parseJobUrlInput(posting)).toEqual({ state: "invalid", message: LOOKS_LIKE_TEXT_MESSAGE });
  });
});
