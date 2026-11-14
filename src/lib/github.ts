import "server-only";

import type { ProjectRole } from "@/db/schema";

/**
 * GitHub REST calls for the repo sync (product plan §3.2, §3.5).
 *
 * The OAuth scope is `read:user user:email`, so only public repos are visible.
 * That's intended for Phase 1; private-repo aggregates come later (§3.4).
 */

const API = "https://api.github.com";

export class GithubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function gh(path: string, token: string, accept = "application/vnd.github+json") {
  const res = await fetch(path.startsWith("http") ? path : `${API}${path}`, {
    headers: {
      Accept: accept,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "User-Agent": "rows-app",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });
  return res;
}

async function ghJson<T>(path: string, token: string): Promise<T> {
  const res = await gh(path, token);
  if (!res.ok) {
    throw new GithubError(`GitHub ${path} failed (${res.status})`, res.status);
  }
  return (await res.json()) as T;
}

/** Page count from a `Link: <…&page=N>; rel="last"` header. */
function lastPage(link: string | null): number | null {
  const match = link?.match(/[?&]page=(\d+)>;\s*rel="last"/);
  return match ? Number(match[1]) : null;
}

export type GithubUserInfo = { login: string; name: string | null; location: string | null; bio: string | null; blog: string | null };

export function fetchGithubUser(token: string) {
  return ghJson<GithubUserInfo>("/user", token);
}

type GithubRepo = {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  homepage: string | null;
  description: string | null;
  language: string | null;
  topics?: string[];
  stargazers_count: number;
  forks_count: number;
  fork: boolean;
  archived: boolean;
  private: boolean;
  pushed_at: string | null;
  created_at: string | null;
  owner: { login: string };
};

export type RepoSummary = {
  externalId: string;
  name: string;
  fullName: string;
  url: string;
  homepage: string | null;
  description: string | null;
  primaryLanguage: string | null;
  topics: string[];
  stars: number;
  forks: number;
  isFork: boolean;
  isArchived: boolean;
  pushedAt: Date | null;
  createdAtSource: Date | null;
};

/** Public repos the user owns or contributes to, most recently pushed first. */
export async function listRepos(token: string): Promise<RepoSummary[]> {
  const repos: GithubRepo[] = [];
  for (let page = 1; page <= 3; page++) {
    const batch = await ghJson<GithubRepo[]>(
      `/user/repos?visibility=public&affiliation=owner,collaborator,organization_member&sort=pushed&per_page=100&page=${page}`,
      token,
    );
    repos.push(...batch);
    if (batch.length < 100) break;
  }

  return repos
    .filter((r) => !r.private)
    .map((r) => ({
      externalId: String(r.id),
      name: r.name,
      fullName: r.full_name,
      url: r.html_url,
      homepage: r.homepage || null,
      description: r.description,
      primaryLanguage: r.language,
      topics: r.topics ?? [],
      stars: r.stargazers_count,
      forks: r.forks_count,
      isFork: r.fork,
      isArchived: r.archived,
      pushedAt: r.pushed_at ? new Date(r.pushed_at) : null,
      createdAtSource: r.created_at ? new Date(r.created_at) : null,
    }));
}

export type RepoDetails = {
  languages: Record<string, number>;
  userCommits: number;
  totalCommits: number;
  firstCommitAt: Date | null;
  lastCommitAt: Date | null;
  role: ProjectRole;
  hasTests: boolean;
  hasCi: boolean;
  dependencies: string[];
  readme: string | null;
};

const README_LIMIT = 12_000;
const TEST_NAMES = /^(tests?|__tests__|spec|specs|test_.*|.*_test|e2e|cypress|playwright\.config\..*|vitest\.config\..*|jest\.config\..*|pytest\.ini|conftest\.py)$/i;

type CommitItem = { commit: { author: { date: string } | null; committer: { date: string } | null } };
type Contributor = { login?: string; contributions: number };
type ContentEntry = { name: string; type: "file" | "dir" };

/** Commits by `login` on the default branch: count, first and last date. */
async function authorCommits(fullName: string, login: string, token: string) {
  const res = await gh(`/repos/${fullName}/commits?author=${encodeURIComponent(login)}&per_page=1`, token);
  if (res.status === 409) return { count: 0, first: null, last: null }; // empty repo
  if (!res.ok) throw new GithubError(`GitHub commits failed (${res.status})`, res.status);
  const latest = (await res.json()) as CommitItem[];
  if (latest.length === 0) return { count: 0, first: null, last: null };

  const pages = lastPage(res.headers.get("link")) ?? 1;
  const dateOf = (c: CommitItem | undefined) => {
    const d = c?.commit.author?.date ?? c?.commit.committer?.date;
    return d ? new Date(d) : null;
  };
  let first = dateOf(latest[0]);
  if (pages > 1) {
    const oldest = await ghJson<CommitItem[]>(
      `/repos/${fullName}/commits?author=${encodeURIComponent(login)}&per_page=1&page=${pages}`,
      token,
    );
    first = dateOf(oldest[0]) ?? first;
  }
  return { count: pages, first, last: dateOf(latest[0]) };
}

function roleFor(userCommits: number, totalCommits: number): ProjectRole {
  if (totalCommits === 0) return "contributor";
  const share = userCommits / totalCommits;
  if (share >= 0.95) return "sole_author";
  if (share >= 0.4) return "main_contributor";
  return "contributor";
}

async function readText(fullName: string, path: string, token: string) {
  const res = await gh(`/repos/${fullName}/contents/${path}`, token, "application/vnd.github.raw+json");
  return res.ok ? res.text() : null;
}

/** Dependency names from the first manifest found at the repo root. */
async function dependenciesFor(fullName: string, rootNames: Set<string>, token: string): Promise<string[]> {
  try {
    if (rootNames.has("package.json")) {
      const pkg = JSON.parse((await readText(fullName, "package.json", token)) ?? "{}") as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      return [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})];
    }
    if (rootNames.has("requirements.txt")) {
      const txt = (await readText(fullName, "requirements.txt", token)) ?? "";
      return txt
        .split("\n")
        .map((l) => l.trim().split(/[=<>~!\[;\s]/)[0])
        .filter((l) => l && !l.startsWith("#") && !l.startsWith("-"));
    }
    if (rootNames.has("go.mod")) {
      const txt = (await readText(fullName, "go.mod", token)) ?? "";
      return [...txt.matchAll(/^\s+([\w./-]+)\s+v[\d.]+/gm)].map((m) => m[1]);
    }
    if (rootNames.has("Cargo.toml")) {
      const txt = (await readText(fullName, "Cargo.toml", token)) ?? "";
      const deps = txt.split(/^\[dependencies\]/m)[1]?.split(/^\[/m)[0] ?? "";
      return [...deps.matchAll(/^([\w-]+)\s*=/gm)].map((m) => m[1]);
    }
  } catch {
    // A malformed manifest shouldn't fail the sync.
  }
  return [];
}

/**
 * Verified signals for one repo (plan §3.2): languages, the user's commit share,
 * tests/CI presence, dependencies and the README the AI card is grounded in.
 */
export async function fetchRepoDetails(fullName: string, login: string, token: string): Promise<RepoDetails> {
  const [languages, contributorsRes, commits, rootRes, workflowsRes, readmeRes] = await Promise.all([
    ghJson<Record<string, number>>(`/repos/${fullName}/languages`, token),
    gh(`/repos/${fullName}/contributors?per_page=100&anon=1`, token),
    authorCommits(fullName, login, token),
    gh(`/repos/${fullName}/contents`, token),
    gh(`/repos/${fullName}/contents/.github/workflows`, token),
    gh(`/repos/${fullName}/readme`, token, "application/vnd.github.raw+json"),
  ]);

  // 204 = empty repo; contributor stats can be missing for very large repos.
  const contributors = contributorsRes.ok && contributorsRes.status !== 204 ? ((await contributorsRes.json()) as Contributor[]) : [];
  const totalCommits = contributors.reduce((sum, c) => sum + c.contributions, 0) || commits.count;
  const mine = contributors.find((c) => c.login?.toLowerCase() === login.toLowerCase())?.contributions;
  const userCommits = Math.max(commits.count, mine ?? 0);

  const root = rootRes.ok ? ((await rootRes.json()) as ContentEntry[]) : [];
  const rootNames = new Set(root.map((e) => e.name));
  const hasTests = root.some((e) => TEST_NAMES.test(e.name));
  const hasCi =
    (workflowsRes.ok && ((await workflowsRes.json()) as ContentEntry[]).length > 0) ||
    rootNames.has(".gitlab-ci.yml") ||
    rootNames.has(".circleci") ||
    rootNames.has(".travis.yml");

  const readme = readmeRes.ok ? (await readmeRes.text()).slice(0, README_LIMIT) : null;
  const dependencies = (await dependenciesFor(fullName, rootNames, token)).slice(0, 80);

  return {
    languages,
    userCommits,
    totalCommits: Math.max(totalCommits, userCommits),
    firstCommitAt: commits.first,
    lastCommitAt: commits.last,
    role: roleFor(userCommits, Math.max(totalCommits, userCommits)),
    hasTests,
    hasCi,
    dependencies,
    readme,
  };
}
