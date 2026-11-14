import { sql } from "drizzle-orm";
import {
  check,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Identity tables (users, accounts) and the public profile (profiles).
 * Later phases add product tables (projects, experiences, discovery…).
 *
 * Every table has Row Level Security enabled with NO policies. The app talks
 * to Postgres directly (DATABASE_URL, `postgres` role, which bypasses RLS), so
 * nothing changes for the server — but Supabase's public REST API
 * (anon / authenticated roles) can no longer read or write these tables.
 * Keep `.enableRLS()` on every new table.
 */
export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
}).enableRLS();

export const accounts = pgTable(
  "accounts",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
).enableRLS();

/**
 * Public profile, 1:1 with users. The row is created at sign-in (with the
 * GitHub login); `username` stays null until the user picks a handle in
 * onboarding, so `username IS NULL` means "onboarding not finished".
 *
 * Uniqueness is enforced by `profiles_username_unique`, not only by a lookup,
 * and the format rule mirrors `src/lib/username.ts`.
 */
export const profiles = pgTable(
  "profiles",
  {
    userId: text("userId")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Public handle: rows.so/u/{username}. Always lowercase. */
    username: text("username"),
    githubLogin: text("githubLogin"),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("profiles_username_unique").on(t.username),
    check(
      "profiles_username_format",
      sql`${t.username} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(${t.username}) BETWEEN 3 AND 39`,
    ),
  ],
).enableRLS();

export type Profile = typeof profiles.$inferSelect;
