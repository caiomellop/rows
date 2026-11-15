import { boolean, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Every table has Row Level Security enabled with NO policies. The app talks
 * to Postgres directly (DATABASE_URL, `postgres` role, which bypasses RLS), so
 * nothing changes for the server — but Supabase's public REST API
 * (anon / authenticated roles) can no longer read or write these tables.
 * Keep `.enableRLS()` on every new table, and REVOKE anon/authenticated
 * access in the migration that creates it.
 */

/* ------------------------------------------------------------------ */
/* Identity (Phase 0)                                                  */
/* ------------------------------------------------------------------ */

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
}).enableRLS();

/**
 * Email login links (MVP-23). Only the SHA-256 of the token is stored; a row
 * is spent by setting `usedAt`. Rows also serve as the request log for rate
 * limiting (per email and per salted IP hash).
 */
export const loginTokens = pgTable(
  "login_tokens",
  {
    tokenHash: text("tokenHash").primaryKey(),
    email: text("email").notNull(),
    ipHash: text("ipHash").notNull(),
    expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),
    usedAt: timestamp("usedAt", { mode: "date" }),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("login_tokens_created").on(t.createdAt)],
).enableRLS();

/* ------------------------------------------------------------------ */
/* Profile and experiences                                             */
/* ------------------------------------------------------------------ */

export type WorkMode = "remote" | "hybrid" | "onsite" | "flexible";

/** Career goals collected by the AI assistant. */
export type ProfileGoals = {
  targetRole?: string;
  targetLevel?: string;
  targetMarket?: string;
};

/** What the AI knows about the user's header and goals. 1:1 with users. */
export const profiles = pgTable("profiles", {
  userId: text("userId")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  displayName: text("displayName"),
  /** One line: "Backend engineer · Go & Postgres · 4 yrs". */
  headline: text("headline"),
  /** The 3-sentence summary. */
  summary: text("summary"),
  summarySource: text("summarySource").$type<"ai" | "user">(),
  location: text("location"),
  timezone: text("timezone"),
  /** e.g. ["Full-time", "Contract"]. */
  roleTypes: jsonb("roleTypes").$type<string[]>().notNull().default([]),
  workMode: text("workMode").$type<WorkMode>(),
  workAuthorization: text("workAuthorization"),
  goals: jsonb("goals").$type<ProfileGoals>().notNull().default({}),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
}).enableRLS();

export const experiences = pgTable(
  "experiences",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"work" | "education">().notNull().default("work"),
    title: text("title").notNull(),
    organization: text("organization").notNull(),
    location: text("location"),
    /** "YYYY-MM" or "YYYY". */
    startDate: text("startDate"),
    /** Null while current. */
    endDate: text("endDate"),
    current: boolean("current").notNull().default(false),
    bullets: jsonb("bullets").$type<string[]>().notNull().default([]),
    skills: jsonb("skills").$type<string[]>().notNull().default([]),
    /** Where it came from. Everything here is self-reported. */
    source: text("source").$type<"resume" | "linkedin" | "assistant" | "manual">().notNull().default("manual"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("experiences_user").on(t.userId)],
).enableRLS();

export type AssistantMessage = { role: "user" | "assistant"; content: string };

/**
 * Conversations with the AI assistant. A user has many; the app sidebar lists
 * them by `updatedAt`.
 */
export const assistantThreads = pgTable(
  "assistant_threads",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New chat"),
    pinned: boolean("pinned").notNull().default(false),
    messages: jsonb("messages").$type<AssistantMessage[]>().notNull().default([]),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("assistant_threads_user_updated").on(t.userId, t.updatedAt)],
).enableRLS();

export type Profile = typeof profiles.$inferSelect;
export type Experience = typeof experiences.$inferSelect;
