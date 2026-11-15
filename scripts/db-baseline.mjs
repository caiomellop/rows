// Prints the SQL that tells Drizzle "these migrations are already applied" on a
// database that was migrated outside of `drizzle-kit migrate` (production was
// migrated through Supabase, so it has no drizzle.__drizzle_migrations table).
//
// It only prints. It never connects to a database. Review the output, take a
// backup, then run it yourself (for example in the Supabase SQL editor).
//
//   npm run db:baseline
//
// Hash and created_at match what drizzle-orm's migrator computes: the sha256
// of each migration file and the `when` of its journal entry.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "drizzle");
const journal = JSON.parse(readFileSync(join(dir, "meta", "_journal.json"), "utf8"));

const rows = journal.entries.map((entry) => {
  const hash = createHash("sha256").update(readFileSync(join(dir, `${entry.tag}.sql`), "utf8")).digest("hex");
  return { tag: entry.tag, hash, createdAt: entry.when };
});

const values = rows
  .map((r, i) => `  ('${r.hash}', ${r.createdAt})${i < rows.length - 1 ? "," : ""} -- ${r.tag}`)
  .join("\n");

console.log(`-- Baseline: mark ${rows.length} migrations as applied. Run once, after a backup.
CREATE SCHEMA IF NOT EXISTS drizzle;

CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);

-- Does nothing if the table already has rows, so it is safe to run twice.
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT v.hash, v.created_at
FROM (VALUES
${values}
) AS v(hash, created_at)
WHERE NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations);`);
