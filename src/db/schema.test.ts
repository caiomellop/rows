import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getTableName, is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import * as schema from "@/db/schema";

const tables = Object.values(schema).filter((v) => is(v, PgTable)) as PgTable[];
const names = tables.map((t) => getTableName(t)).sort();

describe("schema after removing the Rows-only product", () => {
  it("has only the tables the current product uses", () => {
    expect(names).toEqual(["assistant_threads", "experiences", "login_tokens", "profiles", "users"]);
  });

  it("keeps RLS on every table", () => {
    for (const t of tables) expect(getTableConfig(t).enableRLS, getTableName(t)).toBe(true);
  });

  it("has no public-profile or GitHub columns on profiles", () => {
    const columns = getTableConfig(schema.profiles).columns.map((c) => c.name);
    for (const gone of ["username", "githubLogin", "published", "reposSyncedAt", "contactEmail", "openToWork", "links"]) {
      expect(columns).not.toContain(gone);
    }
  });
});

describe("latest migration", () => {
  const journal = JSON.parse(readFileSync(join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as { entries: { tag: string }[] };
  const sql = readFileSync(join(process.cwd(), "drizzle", `${journal.entries.at(-1)!.tag}.sql`), "utf8");

  it("drops the three tables and the public-profile columns explicitly", () => {
    for (const table of ["accounts", "experience_projects", "projects"]) expect(sql).toContain(`DROP TABLE "${table}"`);
    for (const column of ["username", "githubLogin", "published", "reposSyncedAt", "contactEmail", "openToWork", "links"]) {
      expect(sql).toContain(`ALTER TABLE "profiles" DROP COLUMN "${column}"`);
    }
  });
});
