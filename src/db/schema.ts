import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

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
 * Connected platforms (product plan §3.5). One row per provider account:
 * GitHub today; Hugging Face, GitLab and Bitbucket reuse the same table.
 */
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

/* ------------------------------------------------------------------ */
/* Phase 1: profile, projects, experiences                            */
/* ------------------------------------------------------------------ */

export type WorkMode = "remote" | "hybrid" | "onsite" | "flexible";

export type ProfileLinks = {
  linkedin?: string;
  website?: string;
};

/** Career goals collected by the AI assistant (plan §3.7). */
export type ProfileGoals = {
  targetRole?: string;
  targetLevel?: string;
  targetMarket?: string;
};

/** The public profile. 1:1 with users. */
export const profiles = pgTable("profiles", {
  userId: text("userId")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Public handle: rows.so/u/{username}. Starts as the GitHub login. */
  username: text("username").notNull().unique(),
  githubLogin: text("githubLogin"),
  displayName: text("displayName"),
  /** One line: "Backend engineer · Go & Postgres · 4 yrs". */
  headline: text("headline"),
  /** The 3-sentence recruiter summary (plan §3.1). */
  summary: text("summary"),
  summarySource: text("summarySource").$type<"ai" | "user">(),
  location: text("location"),
  timezone: text("timezone"),
  openToWork: boolean("openToWork").notNull().default(false),
  /** e.g. ["Full-time", "Contract"]. */
  roleTypes: jsonb("roleTypes").$type<string[]>().notNull().default([]),
  workMode: text("workMode").$type<WorkMode>(),
  workAuthorization: text("workAuthorization"),
  /** Shown behind the Contact button. Opt-in: empty means no button. */
  contactEmail: text("contactEmail"),
  links: jsonb("links").$type<ProfileLinks>().notNull().default({}),
  goals: jsonb("goals").$type<ProfileGoals>().notNull().default({}),
  published: boolean("published").notNull().default(false),
  reposSyncedAt: timestamp("reposSyncedAt", { mode: "date" }),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
}).enableRLS();

export type ProjectRole = "sole_author" | "main_contributor" | "contributor";

/**
 * One AI sentence plus the source it is grounded in (plan §3.2, grounding rule).
 * `source` names the platform data the claim came from.
 */
export type GroundedPoint = {
  text: string;
  source: "readme" | "languages" | "commits" | "dependencies" | "description" | "topics";
};

export type ProjectCard = {
  /** One plain sentence a non-engineer understands. */
  whatItIs: string;
  /** Up to 3 grounded highlights. */
  highlights: GroundedPoint[];
};

/** A project from a connected platform: a repo today, a model/dataset/Space later. */
export const projects = pgTable(
  "projects",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    source: text("source").$type<"github">().notNull(),
    /** The platform's own id for the project. */
    externalId: text("externalId").notNull(),
    name: text("name").notNull(),
    fullName: text("fullName").notNull(),
    url: text("url").notNull(),
    homepage: text("homepage"),
    description: text("description"),
    /** Language → bytes, from the platform. */
    languages: jsonb("languages").$type<Record<string, number>>().notNull().default({}),
    primaryLanguage: text("primaryLanguage"),
    topics: jsonb("topics").$type<string[]>().notNull().default([]),
    stars: integer("stars").notNull().default(0),
    forks: integer("forks").notNull().default(0),
    isFork: boolean("isFork").notNull().default(false),
    isArchived: boolean("isArchived").notNull().default(false),
    pushedAt: timestamp("pushedAt", { mode: "date" }),
    createdAtSource: timestamp("createdAtSource", { mode: "date" }),

    /* Verified signals, filled when the project is pinned (detail sync). */
    userCommits: integer("userCommits"),
    totalCommits: integer("totalCommits"),
    firstCommitAt: timestamp("firstCommitAt", { mode: "date" }),
    lastCommitAt: timestamp("lastCommitAt", { mode: "date" }),
    role: text("role").$type<ProjectRole>(),
    hasTests: boolean("hasTests"),
    hasCi: boolean("hasCi"),
    /** Dependency names from the manifest (package.json, requirements.txt…). */
    dependencies: jsonb("dependencies").$type<string[]>().notNull().default([]),
    /** README text the AI card is grounded in (truncated). */
    readme: text("readme"),
    detailsSyncedAt: timestamp("detailsSyncedAt", { mode: "date" }),

    /* Presentation. */
    pinned: boolean("pinned").notNull().default(false),
    position: integer("position").notNull().default(0),
    /** AI draft, editable. Shown publicly only once approved. */
    card: jsonb("card").$type<ProjectCard>(),
    cardStatus: text("cardStatus").$type<"none" | "draft" | "approved">().notNull().default("none"),
  },
  (t) => [
    uniqueIndex("projects_user_source_external").on(t.userId, t.source, t.externalId),
    index("projects_user_pinned").on(t.userId, t.pinned),
  ],
).enableRLS();

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
    /** Where it came from. Everything here is self-reported (plan §3.2). */
    source: text("source").$type<"resume" | "linkedin" | "assistant" | "manual">().notNull().default("manual"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("experiences_user").on(t.userId)],
).enableRLS();

/** Projects linked to the job they came from (plan §3.3). */
export const experienceProjects = pgTable(
  "experience_projects",
  {
    experienceId: text("experienceId")
      .notNull()
      .references(() => experiences.id, { onDelete: "cascade" }),
    projectId: text("projectId")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.experienceId, t.projectId] })],
).enableRLS();

export type AssistantMessage = { role: "user" | "assistant"; content: string };

/** The CV interview with the AI assistant (plan §3.7). One open thread per user. */
export const assistantThreads = pgTable("assistant_threads", {
  userId: text("userId")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  messages: jsonb("messages").$type<AssistantMessage[]>().notNull().default([]),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
}).enableRLS();

export type Profile = typeof profiles.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Experience = typeof experiences.$inferSelect;
