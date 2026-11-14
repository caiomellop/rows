import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Identity (Phase 0) + portfolio (Phase 1).
 *
 * `users` doubles as the portfolio profile: one user, one public page at
 * `/u/[username]`. Projects come from GitHub sync or are added by hand;
 * experiences are hand-written and can reference projects.
 */
export const users = pgTable(
  "users",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name"),
    email: text("email").unique(),
    emailVerified: timestamp("emailVerified", { mode: "date" }),
    image: text("image"),

    // Portfolio profile
    /** Public handle, lowercase. Seeded from the GitHub login on first sign-in. */
    username: text("username"),
    githubLogin: text("github_login"),
    headline: text("headline"),
    about: text("about"),
    location: text("location"),
    website: text("website"),
    /** Unpublished profiles 404 for everyone but the owner. */
    published: boolean("published").notNull().default(false),
    lastSyncedAt: timestamp("last_synced_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_username_unique").on(t.username)],
);

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
);

export const projects = pgTable(
  "projects",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** "github" (synced) or "manual". */
    source: text("source").notNull().default("manual"),
    /** GitHub numeric repo id, stable across renames. Null for manual projects. */
    githubRepoId: text("github_repo_id"),
    name: text("name").notNull(),
    description: text("description"),
    url: text("url"),
    homepage: text("homepage"),
    language: text("language"),
    topics: text("topics").array().notNull().default([]),
    stars: integer("stars").notNull().default(0),
    forks: integer("forks").notNull().default(0),
    isFork: boolean("is_fork").notNull().default(false),
    isArchived: boolean("is_archived").notNull().default(false),
    /** Shown on the public profile. */
    visible: boolean("visible").notNull().default(true),
    /** Pinned projects sit at the top, in `position` order. */
    pinned: boolean("pinned").notNull().default(false),
    position: integer("position").notNull().default(0),
    pushedAt: timestamp("pushed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("projects_user_idx").on(t.userId),
    uniqueIndex("projects_user_repo_unique").on(t.userId, t.githubRepoId),
  ],
);

export const experiences = pgTable(
  "experiences",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    company: text("company").notNull(),
    location: text("location"),
    /** "YYYY-MM". */
    startDate: text("start_date").notNull(),
    /** "YYYY-MM", or null while current. */
    endDate: text("end_date"),
    description: text("description"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("experiences_user_idx").on(t.userId)],
);

export const experienceProjects = pgTable(
  "experience_projects",
  {
    experienceId: text("experience_id")
      .notNull()
      .references(() => experiences.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.experienceId, t.projectId] })],
);

export type User = typeof users.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Experience = typeof experiences.$inferSelect;

/**
 * Legacy Auth.js tables from Phase 0. Unused (sessions are a signed cookie),
 * but kept declared so migrations never drop them from an existing database.
 */
export const sessions = pgTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);
