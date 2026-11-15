import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const src = join(root, "src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

const sources = files(src).filter((f) => /\.tsx?$/.test(f) && f !== __filename);

describe("code that was only for the old Rows product", () => {
  it("has no public profile or project routes", () => {
    expect(existsSync(join(src, "app/in"))).toBe(false);
    expect(existsSync(join(src, "app/(app)/dashboard/projects"))).toBe(false);
    expect(existsSync(join(src, "app/onboarding"))).toBe(false);
  });

  it("has no GitHub integration", () => {
    const hits = sources
      .filter((f) => /github[-.]?(oauth)?\.tsx?$/i.test(f) || /api\.github\.com|AUTH_GITHUB|github-oauth|GithubIcon|getGithubToken/.test(readFileSync(f, "utf8")))
      .map((f) => relative(root, f));
    expect(hits).toEqual([]);
  });

  it("does not read the removed tables or profile columns", () => {
    const hits = sources
      .filter((f) => /\b(experienceProjects|schema\.projects|profiles\.(username|published|contactEmail))\b|\{ projects \}/.test(readFileSync(f, "utf8")))
      .map((f) => relative(root, f));
    expect(hits).toEqual([]);
  });
});
