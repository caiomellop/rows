import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  rowsSql: ReturnType<typeof postgres> | undefined;
};

function resolveConnectionString(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  // `next build` / Vercel compile must not require Preview env to be present.
  // Runtime (and local `next dev` / `next start`) still requires DATABASE_URL.
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return "postgresql://build:build@127.0.0.1:5432/rows_build";
  }

  throw new Error(
    "DATABASE_URL is not set. On Vercel: Project → Settings → Environment Variables (enable for Production AND Preview). Locally: copy .env.example to .env.local.",
  );
}

const client =
  globalForDb.rowsSql ??
  postgres(resolveConnectionString(), {
    // Required for Supabase transaction pooler (port 6543).
    prepare: false,
    // A dashboard page reads six tables at once, and the browser prefetches
    // several tabs together; one connection would run all of that in series.
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.rowsSql = client;
}

export const db = drizzle(client, { schema });
