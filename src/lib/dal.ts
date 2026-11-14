import "server-only";

import { and, asc, desc, eq, getTableColumns } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  accounts,
  assistantThreads,
  experienceProjects,
  experiences,
  profiles,
  projects,
  users,
  type Profile,
} from "@/db/schema";
import { stackEvidence } from "@/lib/insights";
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

export async function getGithubToken(userId: string): Promise<string> {
  const [row] = await db
    .select({ token: accounts.access_token })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, "github")))
    .limit(1);
  if (!row?.token) throw new Error("GitHub account is not connected");
  return row.token;
}

/** Tag for every cached read derived from one user's data. */
export const userTag = (userId: string) => `user:${userId}`;

/**
 * The signed-in user's profile. A user without one has not chosen a handle
 * yet, so they are sent to onboarding first.
 */
export async function ensureProfile(user: SessionUser): Promise<Profile> {
  const [existing] = await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1);
  if (!existing) redirect("/onboarding");
  return existing;
}

/**
 * Everything the dashboard edits, in one parallel batch. `profile` is undefined
 * for a user who has not chosen a handle yet. READMEs are left out: they are
 * large and only the AI drafting actions read them.
 */
export async function getEditorData(userId: string) {
  const { readme: _readme, ...projectColumns } = getTableColumns(projects);
  void _readme;
  const [[profile], projectRows, experienceRows, links, [account]] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1),
    db.select(projectColumns).from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.pinned), asc(projects.position), desc(projects.pushedAt)),
    db.select().from(experiences).where(eq(experiences.userId, userId)).orderBy(asc(experiences.position), desc(experiences.startDate)),
    db
      .select({ experienceId: experienceProjects.experienceId, projectId: experienceProjects.projectId })
      .from(experienceProjects)
      .innerJoin(experiences, eq(experiences.id, experienceProjects.experienceId))
      .where(eq(experiences.userId, userId)),
    db.select({ image: users.image, email: users.email }).from(users).where(eq(users.id, userId)).limit(1),
  ]);

  return {
    profile: profile as Profile | undefined,
    projects: projectRows,
    experiences: experienceRows,
    experienceLinks: links,
    image: account?.image ?? null,
    accountEmail: account?.email ?? null,
  };
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

async function profileRow(username: string) {
  const [row] = await db
    .select({ profile: profiles, image: users.image })
    .from(profiles)
    .innerJoin(users, eq(users.id, profiles.userId))
    .where(eq(profiles.username, username.toLowerCase()))
    .limit(1);
  return row ?? null;
}

/** Everything the public page and the resume PDF render, minus private fields. */
async function buildView(row: { profile: Profile; image: string | null }) {
  const userId = row.profile.userId;
  const [pinned, stackRows, experienceRows, links] = await Promise.all([
    db
      .select()
      .from(projects)
      .where(and(eq(projects.userId, userId), eq(projects.pinned, true)))
      .orderBy(asc(projects.position)),
    db
      .select({
        primaryLanguage: projects.primaryLanguage,
        languages: projects.languages,
        pushedAt: projects.pushedAt,
        isFork: projects.isFork,
      })
      .from(projects)
      .where(eq(projects.userId, userId)),
    db.select().from(experiences).where(eq(experiences.userId, userId)).orderBy(asc(experiences.position), desc(experiences.startDate)),
    db
      .select({ experienceId: experienceProjects.experienceId, projectId: experienceProjects.projectId })
      .from(experienceProjects)
      .innerJoin(experiences, eq(experiences.id, experienceProjects.experienceId))
      .where(eq(experiences.userId, userId)),
  ]);

  // Strip what the public page never shows.
  const { contactEmail, goals: _goals, ...profile } = row.profile;
  void _goals;
  return {
    profile: { ...profile, hasContact: Boolean(contactEmail) },
    image: row.image,
    projects: pinned.map(({ readme: _readme, ...p }) => (void _readme, p)),
    stack: stackEvidence(stackRows),
    experiences: experienceRows,
    experienceLinks: links,
  };
}

/**
 * The public profile, cached per username and invalidated with `userTag`
 * whenever the owner edits anything. Only published profiles are returned.
 */
export async function getPublicProfile(username: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`username:${username.toLowerCase()}`);

  const row = await profileRow(username);
  if (!row || !row.profile.published) return null;
  cacheTag(userTag(row.profile.userId));
  return buildView(row);
}

export type PublicProfile = NonNullable<Awaited<ReturnType<typeof getPublicProfile>>>;

/** The owner's own unpublished profile, so they can preview it. Reads the session. */
export async function getOwnerPreview(username: string): Promise<PublicProfile | null> {
  const user = await getSession();
  if (!user) return null;
  const row = await profileRow(username);
  if (!row || row.profile.userId !== user.id) return null;
  return buildView(row);
}

/** Contact email, read only when a visitor clicks Contact (or for the owner's own resume). */
export async function getContactEmail(username: string, opts: { ownerId?: string } = {}) {
  const [row] = await db
    .select({ email: profiles.contactEmail, published: profiles.published, userId: profiles.userId })
    .from(profiles)
    .where(eq(profiles.username, username.toLowerCase()))
    .limit(1);
  if (!row) return null;
  return row.published || row.userId === opts.ownerId ? row.email : null;
}
