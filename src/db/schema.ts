import {
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Phase 0 identity tables.
 * Phase 1 will extend `users` and add product tables
 * (connected_accounts, projects, experiences, experience_projects).
 */
export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  // Stable public handle for /u/[username]; see src/lib/username.ts.
  // Nullable so existing rows survive the migration (filled on next login).
  username: text("username").unique(),
  // Deliberately NOT unique: users are identified by (provider,
  // providerAccountId), never by email. A unique email made login fail when two
  // GitHub accounts shared one, and linking accounts by email is unsafe.
  email: text("email"),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

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
