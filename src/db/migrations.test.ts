import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const journal = JSON.parse(readFileSync(join(root, "drizzle/meta/_journal.json"), "utf8")) as {
  entries: { idx: number; tag: string; when: number }[];
};
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { scripts: Record<string, string> };

describe("migration scripts", () => {
  it("has db:migrate and no db:push", () => {
    expect(pkg.scripts["db:migrate"]).toBe("drizzle-kit migrate");
    expect(pkg.scripts).not.toHaveProperty("db:push");
  });
});

describe("migration journal", () => {
  it("has a SQL file and a snapshot for every entry", () => {
    for (const entry of journal.entries) {
      expect(existsSync(join(root, "drizzle", `${entry.tag}.sql`)), entry.tag).toBe(true);
      const prefix = entry.tag.slice(0, 4);
      expect(existsSync(join(root, "drizzle/meta", `${prefix}_snapshot.json`)), entry.tag).toBe(true);
    }
  });

  it("is ordered by index and by time", () => {
    journal.entries.forEach((entry, i) => expect(entry.idx).toBe(i));
    const times = journal.entries.map((e) => e.when);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });
});

describe("db:baseline", () => {
  const sql = execFileSync("node", ["scripts/db-baseline.mjs"], { cwd: root, encoding: "utf8" });

  it("lists every migration with the hash and time drizzle's migrator uses", () => {
    for (const entry of journal.entries) {
      const hash = createHash("sha256").update(readFileSync(join(root, "drizzle", `${entry.tag}.sql`), "utf8")).digest("hex");
      expect(sql).toContain(`('${hash}', ${entry.when})`);
    }
  });

  it("keeps commas out of the comments so the VALUES list is valid", () => {
    const valueLines = sql.split("\n").filter((line) => /^\s+\('[0-9a-f]{64}', \d+\)/.test(line));
    expect(valueLines).toHaveLength(journal.entries.length);
    valueLines.forEach((line, i) => {
      const beforeComment = line.split(" --")[0];
      expect(beforeComment.endsWith(",")).toBe(i < valueLines.length - 1);
    });
  });

  it("does nothing when the migrations table already has rows", () => {
    expect(sql).toContain("WHERE NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations)");
  });
});
