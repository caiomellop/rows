import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  rowsSql: ReturnType<typeof postgres> | undefined;
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. On Vercel: Project → Settings → Environment Variables. Locally: copy .env.example to .env.local.",
  );
}

const client =
  globalForDb.rowsSql ??
  postgres(connectionString, {
    // Required for Supabase transaction pooler (port 6543).
    prepare: false,
    max: 1,
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.rowsSql = client;
}

export const db = drizzle(client, { schema });
