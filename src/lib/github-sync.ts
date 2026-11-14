import "server-only";

import { and, eq, isNotNull, notInArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { accounts, projects, users } from "@/db/schema";

const GITHUB_API = (process.env.GITHUB_API_URL ?? "https://api.github.com").replace(/\/$/, "");
/** 3 pages × 100 repos. Anyone with more than 300 public repos keeps the most recently pushed. */
const MAX_PAGES = 3;

type GithubRepo = {
  id: number;
  name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  topics?: string[];
  stargazers_count: number;
  forks_count: number;
  fork: boolean;
  archived: boolean;
  private: boolean;
  pushed_at: string | null;
};

export class GithubSyncError extends Error {
  constructor(
    message: string,
    readonly reconnect = false,
  ) {
    super(message);
  }
}

async function fetchPublicRepos(accessToken: string): Promise<GithubRepo[]> {
  const repos: GithubRepo[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const params = new URLSearchParams({
      visibility: "public",
      affiliation: "owner",
      sort: "pushed",
      per_page: "100",
      page: String(page),
    });
    const res = await fetch(`${GITHUB_API}/user/repos?${params}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "rows-app",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    });

    if (res.status === 401) {
      throw new GithubSyncError("GitHub access expired. Sign in again to reconnect.", true);
    }
    if (!res.ok) {
      throw new GithubSyncError(`GitHub returned ${res.status}. Try again in a minute.`);
    }

    const batch = (await res.json()) as GithubRepo[];
    repos.push(...batch.filter((r) => !r.private));
    if (batch.length < 100) break;
  }

  return repos;
}

/**
 * Pulls the user's public GitHub repos into `projects`.
 *
 * Repo metadata (name, description, stars…) is refreshed on every sync; what the
 * user chose (visible, pinned, position) is never overwritten. Repos that are
 * gone from GitHub (deleted, renamed away, made private) are removed.
 * New forks and archived repos start hidden.
 */
export async function syncGithubRepos(userId: string) {
  const [account] = await db
    .select({ accessToken: accounts.access_token })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, "github")))
    .limit(1);

  if (!account?.accessToken) {
    throw new GithubSyncError("No GitHub account is connected. Sign in again.", true);
  }

  const repos = await fetchPublicRepos(account.accessToken);
  const now = new Date();

  await db.transaction(async (tx) => {
    if (repos.length > 0) {
      await tx
        .insert(projects)
        .values(
          repos.map((r) => ({
            userId,
            source: "github",
            githubRepoId: String(r.id),
            name: r.name,
            description: r.description,
            url: r.html_url,
            homepage: r.homepage || null,
            language: r.language,
            topics: r.topics ?? [],
            stars: r.stargazers_count,
            forks: r.forks_count,
            isFork: r.fork,
            isArchived: r.archived,
            visible: !r.fork && !r.archived,
            pushedAt: r.pushed_at ? new Date(r.pushed_at) : null,
          })),
        )
        .onConflictDoUpdate({
          target: [projects.userId, projects.githubRepoId],
          set: {
            name: sql`excluded.name`,
            description: sql`excluded.description`,
            url: sql`excluded.url`,
            homepage: sql`excluded.homepage`,
            language: sql`excluded.language`,
            topics: sql`excluded.topics`,
            stars: sql`excluded.stars`,
            forks: sql`excluded.forks`,
            isFork: sql`excluded.is_fork`,
            isArchived: sql`excluded.is_archived`,
            pushedAt: sql`excluded.pushed_at`,
            updatedAt: now,
          },
        });
    }

    const keep = repos.map((r) => String(r.id));
    await tx
      .delete(projects)
      .where(
        and(
          eq(projects.userId, userId),
          eq(projects.source, "github"),
          isNotNull(projects.githubRepoId),
          keep.length > 0 ? notInArray(projects.githubRepoId, keep) : undefined,
        ),
      );

    await tx.update(users).set({ lastSyncedAt: now }).where(eq(users.id, userId));
  });

  return { count: repos.length };
}
