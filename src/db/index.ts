import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  rowsSql: ReturnType<typeof postgres> | undefined;
};

function createClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and add your Supabase Postgres URL.",
    );
  }

  // prepare: false is required for Supabase transaction pooler (port 6543).
  return postgres(connectionString, { prepare: false });
}

const client = globalForDb.rowsSql ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForDb.rowsSql = client;
}

export const db = drizzle(client, { schema });
