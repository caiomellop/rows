import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { assistantThreads, experiences, profiles, type Profile } from "@/db/schema";
import { getSession, type SessionUser } from "@/lib/session";

/**
 * Data Access Layer: every read and write of user data goes through here,
 * and every exported write re-checks the session.
 */

export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/sign-in");
  return user;
}

/** Tag for every cached read derived from one user's data. */
export const userTag = (userId: string) => `user:${userId}`;

/**
 * The signed-in user's profile. It is created on first use, so a new user goes
 * straight to the app. A double submit or two tabs at once are safe: the
 * primary key on userId turns the second insert into a no-op.
 */
export async function ensureProfile(user: SessionUser): Promise<Profile> {
  const find = () => db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1);
  const [existing] = await find();
  if (existing) return existing;

  await db.insert(profiles).values({ userId: user.id, displayName: user.name }).onConflictDoNothing();
  const [created] = await find();
  return created;
}

/** Everything the dashboard edits, in one parallel batch. `profile` is undefined until the first visit creates it. */
export async function getEditorData(userId: string) {
  const [[profile], experienceRows] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1),
    db.select().from(experiences).where(eq(experiences.userId, userId)).orderBy(asc(experiences.position), desc(experiences.startDate)),
  ]);

  return { profile: profile as Profile | undefined, experiences: experienceRows };
}

export type EditorData = Awaited<ReturnType<typeof getEditorData>>;

/** How many unpinned conversations the sidebar lists. */
const RECENT_THREADS = 20;

/** The user's conversations for the sidebar: every pinned one, then the latest. */
export async function listThreads(userId: string) {
  const cols = {
    id: assistantThreads.id,
    title: assistantThreads.title,
    pinned: assistantThreads.pinned,
    updatedAt: assistantThreads.updatedAt,
  };
  const mine = (pinned: boolean) => and(eq(assistantThreads.userId, userId), eq(assistantThreads.pinned, pinned));
  const [pinned, recent] = await Promise.all([
    db.select(cols).from(assistantThreads).where(mine(true)).orderBy(desc(assistantThreads.updatedAt)).limit(RECENT_THREADS),
    db.select(cols).from(assistantThreads).where(mine(false)).orderBy(desc(assistantThreads.updatedAt)).limit(RECENT_THREADS),
  ]);
  return { pinned, recent };
}

export type ThreadSummary = Awaited<ReturnType<typeof listThreads>>["recent"][number];

/** One conversation, only if it belongs to the user. */
export async function getThread(userId: string, threadId: string) {
  const [row] = await db
    .select()
    .from(assistantThreads)
    .where(and(eq(assistantThreads.id, threadId), eq(assistantThreads.userId, userId)))
    .limit(1);
  return row ?? null;
}
