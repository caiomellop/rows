import "server-only";

import { asc, desc, eq, inArray } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { experienceProjects, experiences, projects, users } from "@/db/schema";
import { getSession } from "@/lib/session";

export type PortfolioProject = {
  id: string;
  source: string;
  name: string;
  description: string | null;
  url: string | null;
  homepage: string | null;
  language: string | null;
  topics: string[];
  stars: number;
  forks: number;
  isFork: boolean;
  isArchived: boolean;
  visible: boolean;
  pinned: boolean;
  position: number;
  pushedAt: string | null;
};

export type PortfolioExperience = {
  id: string;
  role: string;
  company: string;
  location: string | null;
  startDate: string;
  endDate: string | null;
  description: string | null;
  projectIds: string[];
};

export type PortfolioProfile = {
  id: string;
  username: string | null;
  name: string | null;
  image: string | null;
  githubLogin: string | null;
  headline: string | null;
  about: string | null;
  location: string | null;
  website: string | null;
  published: boolean;
  lastSyncedAt: string | null;
};

export type Portfolio = {
  profile: PortfolioProfile;
  projects: PortfolioProject[];
  experiences: PortfolioExperience[];
};

/** Cache tag for everything rendered on `/u/[username]`. */
export function profileTag(username: string) {
  return `profile:${username}`;
}

/**
 * Pinned first (in the order the user set), then the rest by last push.
 * Manual projects without a push date sort after dated ones.
 */
function sortProjects(list: PortfolioProject[]) {
  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.pinned) return a.position - b.position;
    return (b.pushedAt ?? "").localeCompare(a.pushedAt ?? "");
  });
}

/** Current first, then by end date, then by start date (newest first). */
function sortExperiences(list: PortfolioExperience[]) {
  return [...list].sort((a, b) => {
    const endA = a.endDate ?? "9999-99";
    const endB = b.endDate ?? "9999-99";
    if (endA !== endB) return endB.localeCompare(endA);
    return b.startDate.localeCompare(a.startDate);
  });
}

async function loadPortfolio(userId: string): Promise<Portfolio | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return null;

  const [projectRows, experienceRows] = await Promise.all([
    db.select().from(projects).where(eq(projects.userId, userId)).orderBy(asc(projects.position)),
    db
      .select()
      .from(experiences)
      .where(eq(experiences.userId, userId))
      .orderBy(desc(experiences.startDate)),
  ]);

  const links =
    experienceRows.length > 0
      ? await db
          .select()
          .from(experienceProjects)
          .where(
            inArray(
              experienceProjects.experienceId,
              experienceRows.map((e) => e.id),
            ),
          )
      : [];

  return {
    profile: {
      id: user.id,
      username: user.username,
      name: user.name,
      image: user.image,
      githubLogin: user.githubLogin,
      headline: user.headline,
      about: user.about,
      location: user.location,
      website: user.website,
      published: user.published,
      lastSyncedAt: user.lastSyncedAt?.toISOString() ?? null,
    },
    projects: sortProjects(
      projectRows.map((p) => ({
        id: p.id,
        source: p.source,
        name: p.name,
        description: p.description,
        url: p.url,
        homepage: p.homepage,
        language: p.language,
        topics: p.topics,
        stars: p.stars,
        forks: p.forks,
        isFork: p.isFork,
        isArchived: p.isArchived,
        visible: p.visible,
        pinned: p.pinned,
        position: p.position,
        pushedAt: p.pushedAt?.toISOString() ?? null,
      })),
    ),
    experiences: sortExperiences(
      experienceRows.map((e) => ({
        id: e.id,
        role: e.role,
        company: e.company,
        location: e.location,
        startDate: e.startDate,
        endDate: e.endDate,
        description: e.description,
        projectIds: links.filter((l) => l.experienceId === e.id).map((l) => l.projectId),
      })),
    ),
  };
}

/** Strips what visitors must not see: hidden projects and links to them. */
export function toPublicView(portfolio: Portfolio): Portfolio {
  const visible = portfolio.projects.filter((p) => p.visible);
  const visibleIds = new Set(visible.map((p) => p.id));
  return {
    profile: portfolio.profile,
    projects: visible,
    experiences: portfolio.experiences.map((e) => ({
      ...e,
      projectIds: e.projectIds.filter((id) => visibleIds.has(id)),
    })),
  };
}

/**
 * The public portfolio for `/u/[username]`. Cached on the server and
 * invalidated with `profileTag(username)` whenever the owner edits anything.
 * Returns null for unknown or unpublished profiles.
 */
export async function getPublicPortfolio(username: string): Promise<Portfolio | null> {
  "use cache";
  cacheTag(profileTag(username));
  cacheLife("hours");

  const [row] = await db
    .select({ id: users.id, published: users.published })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (!row?.published) return null;

  const portfolio = await loadPortfolio(row.id);
  return portfolio ? toPublicView(portfolio) : null;
}

/** Data Access Layer: the signed-in user's id, or a redirect to sign in. */
export async function requireUserId(): Promise<string> {
  const session = await getSession();
  if (!session) redirect("/auth/signin");
  return session.id;
}

/** The signed-in user's full portfolio (hidden projects included), uncached. */
export async function getOwnPortfolio(): Promise<Portfolio> {
  const userId = await requireUserId();
  const portfolio = await loadPortfolio(userId);
  // A valid cookie for a deleted user: send them back through sign-in.
  if (!portfolio) redirect("/auth/logout");
  return portfolio;
}
