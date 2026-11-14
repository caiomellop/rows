"use server";

import { and, eq, inArray, max, sql } from "drizzle-orm";
import mammoth from "mammoth";
import { updateTag } from "next/cache";

import { db } from "@/db";
import {
  assistantThreads,
  experienceProjects,
  experiences,
  profiles,
  projects,
  type AssistantMessage,
  type GroundedPoint,
  type Profile,
  type WorkMode,
} from "@/db/schema";
import {
  AiError,
  draftProjectCard,
  draftSummary,
  extractFromInterview,
  interviewReply,
  parseResume,
  type ParsedResume,
} from "@/lib/ai";
import { ensureProfile, getGithubToken, requireUser, userTag } from "@/lib/dal";
import { fetchRepoDetails, listRepos } from "@/lib/github";
import { MAX_PINNED, ROLE_TYPES, stackEvidence } from "@/lib/insights";

/**
 * Every action re-reads the session and only touches rows the user owns.
 * After a write, `updateTag` refreshes the public page and re-renders the dashboard.
 */

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

function fail(err: unknown): ActionResult {
  if (err instanceof AiError) return { ok: false, error: err.message };
  console.error(err);
  return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
}

async function owner() {
  const user = await requireUser();
  const profile = await ensureProfile(user);
  return { userId: user.id, profile };
}

function refresh(profile: Pick<Profile, "userId" | "username">) {
  updateTag(userTag(profile.userId));
  updateTag(`username:${profile.username}`);
}

async function ownedProject(userId: string, projectId: string) {
  const [row] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  if (!row) throw new Error("Project not found.");
  return row;
}

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

export async function syncRepos(): Promise<ActionResult> {
  try {
    const { userId, profile } = await owner();
    const repos = await listRepos(await getGithubToken(userId));

    for (const r of repos) {
      await db
        .insert(projects)
        .values({ userId, source: "github", ...r })
        .onConflictDoUpdate({
          target: [projects.userId, projects.source, projects.externalId],
          set: {
            name: r.name,
            fullName: r.fullName,
            url: r.url,
            homepage: r.homepage,
            description: r.description,
            primaryLanguage: r.primaryLanguage,
            topics: r.topics,
            stars: r.stars,
            forks: r.forks,
            isFork: r.isFork,
            isArchived: r.isArchived,
            pushedAt: r.pushedAt,
          },
        });
    }
    await db.update(profiles).set({ reposSyncedAt: new Date(), updatedAt: new Date() }).where(eq(profiles.userId, userId));

    refresh(profile);
    return { ok: true, message: `Synced ${repos.length} public repos.` };
  } catch (err) {
    return fail(err);
  }
}

/** Pulls the verified signals (commits, tests, README…) for one repo. */
async function syncDetails(userId: string, projectId: string, login: string) {
  const project = await ownedProject(userId, projectId);
  const details = await fetchRepoDetails(project.fullName, login, await getGithubToken(userId));
  const [updated] = await db
    .update(projects)
    .set({ ...details, detailsSyncedAt: new Date() })
    .where(eq(projects.id, projectId))
    .returning();
  return updated;
}

export async function setPinned(projectId: string, pinned: boolean): Promise<ActionResult> {
  try {
    const { userId, profile } = await owner();
    const project = await ownedProject(userId, projectId);

    if (pinned && !project.pinned) {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(projects)
        .where(and(eq(projects.userId, userId), eq(projects.pinned, true)));
      if (count >= MAX_PINNED) return { ok: false, error: `You can pin up to ${MAX_PINNED} projects. Unpin one first.` };

      const [{ top }] = await db.select({ top: max(projects.position) }).from(projects).where(and(eq(projects.userId, userId), eq(projects.pinned, true)));
      await db.update(projects).set({ pinned: true, position: (top ?? 0) + 1 }).where(eq(projects.id, projectId));
      if (!project.detailsSyncedAt && profile.githubLogin) {
        try {
          await syncDetails(userId, projectId, profile.githubLogin);
        } catch (err) {
          // The pin stands; signals can be loaded later with "Refresh from GitHub".
          console.error(err);
          refresh(profile);
          return { ok: true, message: "Pinned, but GitHub didn't answer. Use “Refresh from GitHub” on the card." };
        }
      }
    } else if (!pinned) {
      await db.update(projects).set({ pinned: false }).where(eq(projects.id, projectId));
    }

    refresh(profile);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function movePinned(projectId: string, direction: -1 | 1): Promise<ActionResult> {
  try {
    const { userId, profile } = await owner();
    const pinned = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.userId, userId), eq(projects.pinned, true)))
      .orderBy(projects.position);
    const index = pinned.findIndex((p) => p.id === projectId);
    const swap = index + direction;
    if (index < 0 || swap < 0 || swap >= pinned.length) return { ok: true };

    [pinned[index], pinned[swap]] = [pinned[swap], pinned[index]];
    await Promise.all(pinned.map((p, i) => db.update(projects).set({ position: i + 1 }).where(eq(projects.id, p.id))));

    refresh(profile);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function draftCard(projectId: string): Promise<ActionResult> {
  try {
    const { userId, profile } = await owner();
    let project = await ownedProject(userId, projectId);
    if (!project.detailsSyncedAt && profile.githubLogin) {
      project = await syncDetails(userId, projectId, profile.githubLogin);
    }
    const card = await draftProjectCard(project);
    await db.update(projects).set({ card, cardStatus: "draft" }).where(eq(projects.id, projectId));

    refresh(profile);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function refreshDetails(projectId: string): Promise<ActionResult> {
  try {
    const { userId, profile } = await owner();
    if (!profile.githubLogin) return { ok: false, error: "GitHub login unknown. Sign in again." };
    await syncDetails(userId, projectId, profile.githubLogin);
    refresh(profile);
    return { ok: true, message: "Signals refreshed from GitHub." };
  } catch (err) {
    return fail(err);
  }
}

/** Saves the owner's edits and approves the card for the public page. */
export async function saveCard(projectId: string, formData: FormData): Promise<ActionResult> {
  try {
    const { userId, profile } = await owner();
    const project = await ownedProject(userId, projectId);

    const whatItIs = String(formData.get("whatItIs") ?? "").trim().slice(0, 300);
    if (!whatItIs) return { ok: false, error: "Add one sentence about what the project is." };

    const previous = project.card?.highlights ?? [];
    const highlights: GroundedPoint[] = [];
    for (let i = 0; i < 3; i++) {
      const text = String(formData.get(`highlight-${i}`) ?? "").trim().slice(0, 200);
      if (!text) continue;
      // An edited highlight keeps its source; the owner vouches for the wording.
      highlights.push({ text, source: previous[i]?.source ?? "description" });
    }

    await db.update(projects).set({ card: { whatItIs, highlights }, cardStatus: "approved" }).where(eq(projects.id, projectId));
    refresh(profile);
    return { ok: true, message: "Card approved. It's on your public page." };
  } catch (err) {
    return fail(err);
  }
}

/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

const USERNAME = /^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/;
const RESERVED = new Set(["admin", "api", "auth", "dashboard", "pricing", "u", "settings", "about", "help", "rows"]);

function optionalUrl(value: FormDataEntryValue | null): string | undefined {
  const v = String(value ?? "").trim();
  if (!v) return undefined;
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function clean(value: FormDataEntryValue | null, maxLength: number): string | null {
  const v = String(value ?? "").trim().slice(0, maxLength);
  return v || null;
}

export async function saveProfile(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const { userId, profile } = await owner();

    const username = String(formData.get("username") ?? "").trim().toLowerCase();
    if (!USERNAME.test(username) || RESERVED.has(username)) {
      return { ok: false, error: "Username: 1–39 lowercase letters, numbers or dashes." };
    }
    if (username !== profile.username) {
      const [taken] = await db.select({ id: profiles.userId }).from(profiles).where(eq(profiles.username, username)).limit(1);
      if (taken) return { ok: false, error: `rows.so/in/@${username} is taken.` };
    }

    const summary = clean(formData.get("summary"), 800);
    const summarySource = String(formData.get("summarySource") ?? "") === "ai" && summary ? "ai" : summary ? "user" : null;
    const workMode = String(formData.get("workMode") ?? "");
    const contactEmail = clean(formData.get("contactEmail"), 200);
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      return { ok: false, error: "The contact email doesn't look right." };
    }

    await db
      .update(profiles)
      .set({
        username,
        displayName: clean(formData.get("displayName"), 100),
        headline: clean(formData.get("headline"), 120),
        summary,
        summarySource: summary === profile.summary ? profile.summarySource : summarySource,
        location: clean(formData.get("location"), 100),
        timezone: clean(formData.get("timezone"), 60),
        openToWork: formData.get("openToWork") === "on",
        roleTypes: formData.getAll("roleTypes").map(String).filter((r) => (ROLE_TYPES as readonly string[]).includes(r)),
        workMode: (["remote", "hybrid", "onsite", "flexible"].includes(workMode) ? workMode : null) as WorkMode | null,
        workAuthorization: clean(formData.get("workAuthorization"), 120),
        contactEmail,
        links: { linkedin: optionalUrl(formData.get("linkedin")), website: optionalUrl(formData.get("website")) },
        goals: {
          targetRole: clean(formData.get("targetRole"), 100) ?? undefined,
          targetLevel: clean(formData.get("targetLevel"), 60) ?? undefined,
          targetMarket: clean(formData.get("targetMarket"), 100) ?? undefined,
        },
        updatedAt: new Date(),
      })
      .where(eq(profiles.userId, userId));

    refresh(profile);
    if (username !== profile.username) updateTag(`username:${username}`);
    return { ok: true, message: "Profile saved." };
  } catch (err) {
    return fail(err);
  }
}

export type SummaryDraft = { ok: true; headline: string; summary: string } | { ok: false; error: string };

/** Returns a draft for the form; nothing is saved until the owner saves. */
export async function draftProfileSummary(): Promise<SummaryDraft> {
  try {
    const { userId, profile } = await owner();
    const [allProjects, experienceRows] = await Promise.all([
      db.select().from(projects).where(eq(projects.userId, userId)),
      db.select().from(experiences).where(eq(experiences.userId, userId)),
    ]);
    const pinned = allProjects.filter((p) => p.pinned);
    const draft = await draftSummary({
      profile,
      projects: pinned,
      experiences: experienceRows,
      stack: stackEvidence(allProjects),
    });
    return { ok: true, ...draft };
  } catch (err) {
    const r = fail(err);
    return r.ok ? { ok: false, error: "Something went wrong." } : r;
  }
}

export async function setPublished(published: boolean): Promise<ActionResult> {
  try {
    const { userId, profile } = await owner();
    await db.update(profiles).set({ published, updatedAt: new Date() }).where(eq(profiles.userId, userId));
    refresh(profile);
    return { ok: true, message: published ? "Your profile is live." : "Your profile is hidden." };
  } catch (err) {
    return fail(err);
  }
}

/* ------------------------------------------------------------------ */
/* Experience                                                          */
/* ------------------------------------------------------------------ */

const MAX_UPLOAD = 4 * 1024 * 1024;

type NewExperience = ParsedResume["experiences"][number];

const key = (e: { title: string; organization: string }) => `${e.title.trim().toLowerCase()}|${e.organization.trim().toLowerCase()}`;

async function addExperiences(userId: string, items: NewExperience[], source: "resume" | "linkedin" | "assistant") {
  const existing = await db.select().from(experiences).where(eq(experiences.userId, userId));
  const byKey = new Map(existing.map((e) => [key(e), e]));
  let added = 0;
  let merged = 0;
  let position = existing.length;

  for (const item of items) {
    if (!item.title.trim() || !item.organization.trim()) continue;
    const match = byKey.get(key(item));
    if (match) {
      const bullets = [...match.bullets];
      for (const b of item.bullets) if (!bullets.some((x) => x.toLowerCase() === b.toLowerCase())) bullets.push(b);
      const skills = [...new Set([...match.skills, ...item.skills])];
      await db
        .update(experiences)
        .set({
          bullets,
          skills,
          startDate: match.startDate ?? item.startDate,
          endDate: match.endDate ?? item.endDate,
          location: match.location ?? item.location,
        })
        .where(eq(experiences.id, match.id));
      merged++;
    } else {
      const [row] = await db
        .insert(experiences)
        .values({ userId, ...item, title: item.title.trim(), organization: item.organization.trim(), source, position: position++ })
        .returning();
      byKey.set(key(row), row);
      added++;
    }
  }
  return { added, merged };
}

export async function importResume(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const { userId, profile } = await owner();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a PDF, DOCX or TXT file." };
    if (file.size > MAX_UPLOAD) return { ok: false, error: "That file is over 4 MB." };

    const source = formData.get("source") === "linkedin" ? "linkedin" : "resume";
    const name = file.name.toLowerCase();
    const bytes = Buffer.from(await file.arrayBuffer());

    let parsed: ParsedResume;
    if (name.endsWith(".pdf") || file.type === "application/pdf") {
      parsed = await parseResume({ kind: "pdf", base64: bytes.toString("base64") });
    } else if (name.endsWith(".docx")) {
      const { value } = await mammoth.extractRawText({ buffer: bytes });
      parsed = await parseResume({ kind: "text", text: value });
    } else if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".csv")) {
      // .csv covers LinkedIn's data export (Positions.csv, Education.csv).
      parsed = await parseResume({ kind: "text", text: bytes.toString("utf8") });
    } else {
      return { ok: false, error: "Use a PDF, DOCX, TXT or LinkedIn CSV file." };
    }

    const { added, merged } = await addExperiences(userId, parsed.experiences, source);

    // Fill empty header fields only; never overwrite what the owner wrote.
    await db
      .update(profiles)
      .set({
        displayName: profile.displayName ?? parsed.displayName,
        headline: profile.headline ?? parsed.headline,
        location: profile.location ?? parsed.location,
        updatedAt: new Date(),
      })
      .where(eq(profiles.userId, userId));

    refresh(profile);
    return {
      ok: true,
      message: `Imported ${added} new ${added === 1 ? "entry" : "entries"}${merged ? `, updated ${merged}` : ""}. Review them below.`,
    };
  } catch (err) {
    return fail(err);
  }
}

function experienceFields(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  const organization = String(formData.get("organization") ?? "").trim().slice(0, 120);
  const date = (v: FormDataEntryValue | null) => {
    const s = String(v ?? "").trim();
    return /^\d{4}(-\d{2})?$/.test(s) ? s : null;
  };
  const current = formData.get("current") === "on";
  return {
    kind: (formData.get("kind") === "education" ? "education" : "work") as "work" | "education",
    title,
    organization,
    location: clean(formData.get("location"), 100),
    startDate: date(formData.get("startDate")),
    endDate: current ? null : date(formData.get("endDate")),
    current,
    bullets: String(formData.get("bullets") ?? "")
      .split("\n")
      .map((b) => b.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 12),
    skills: String(formData.get("skills") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20),
  };
}

export async function saveExperience(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const { userId, profile } = await owner();
    const fields = experienceFields(formData);
    if (!fields.title || !fields.organization) return { ok: false, error: "Add a title and an organization." };

    const id = String(formData.get("id") ?? "");
    let experienceId = id;
    if (id) {
      const result = await db
        .update(experiences)
        .set(fields)
        .where(and(eq(experiences.id, id), eq(experiences.userId, userId)))
        .returning({ id: experiences.id });
      if (!result[0]) return { ok: false, error: "Entry not found." };
    } else {
      const [{ top }] = await db.select({ top: max(experiences.position) }).from(experiences).where(eq(experiences.userId, userId));
      const [row] = await db
        .insert(experiences)
        .values({ userId, ...fields, source: "manual", position: (top ?? -1) + 1 })
        .returning({ id: experiences.id });
      experienceId = row.id;
    }

    // Projects linked to this job (plan §3.3). Only the owner's projects count.
    const wanted = formData.getAll("projectIds").map(String);
    const owned = wanted.length
      ? await db.select({ id: projects.id }).from(projects).where(and(eq(projects.userId, userId), inArray(projects.id, wanted)))
      : [];
    await db.delete(experienceProjects).where(eq(experienceProjects.experienceId, experienceId));
    if (owned.length) {
      await db.insert(experienceProjects).values(owned.map((p) => ({ experienceId, projectId: p.id })));
    }

    refresh(profile);
    return { ok: true, message: "Saved." };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteExperience(id: string): Promise<ActionResult> {
  try {
    const { userId, profile } = await owner();
    await db.delete(experiences).where(and(eq(experiences.id, id), eq(experiences.userId, userId)));
    refresh(profile);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/* ------------------------------------------------------------------ */
/* CV interview assistant                                              */
/* ------------------------------------------------------------------ */

async function loadThread(userId: string): Promise<AssistantMessage[]> {
  const [row] = await db.select().from(assistantThreads).where(eq(assistantThreads.userId, userId)).limit(1);
  return row?.messages ?? [];
}

async function storeThread(userId: string, messages: AssistantMessage[]) {
  await db
    .insert(assistantThreads)
    .values({ userId, messages, updatedAt: new Date() })
    .onConflictDoUpdate({ target: assistantThreads.userId, set: { messages, updatedAt: new Date() } });
}

export type ChatResult = { ok: true; messages: AssistantMessage[] } | { ok: false; error: string; messages: AssistantMessage[] };

/** Sends the user's message (or starts the interview when `text` is empty). */
export async function sendInterviewMessage(text: string): Promise<ChatResult> {
  const { userId, profile } = await owner();
  const history = await loadThread(userId);
  const message = text.trim().slice(0, 4000);
  const messages: AssistantMessage[] = message ? [...history, { role: "user", content: message }] : history;

  try {
    const [experienceRows, pinned] = await Promise.all([
      db.select().from(experiences).where(eq(experiences.userId, userId)),
      db.select().from(projects).where(and(eq(projects.userId, userId), eq(projects.pinned, true))),
    ]);
    const reply = await interviewReply({ profile, experiences: experienceRows, projects: pinned, messages });
    const next: AssistantMessage[] = [...messages, { role: "assistant", content: reply }];
    await storeThread(userId, next);
    return { ok: true, messages: next };
  } catch (err) {
    // Keep the user's message so they don't lose what they typed.
    await storeThread(userId, messages);
    const r = fail(err);
    return { ok: false, error: r.ok ? "Something went wrong." : r.error, messages };
  }
}

export async function resetInterview(): Promise<ActionResult> {
  const { userId } = await owner();
  await storeThread(userId, []);
  return { ok: true };
}

export async function saveInterviewToCv(): Promise<ActionResult> {
  try {
    const { userId, profile } = await owner();
    const messages = await loadThread(userId);
    if (!messages.some((m) => m.role === "user")) return { ok: false, error: "Answer a few questions first." };

    const extract = await extractFromInterview(messages);
    const { added, merged } = await addExperiences(userId, extract.experiences, "assistant");
    const g = extract.goals;
    await db
      .update(profiles)
      .set({
        goals: {
          targetRole: g.targetRole ?? profile.goals.targetRole,
          targetLevel: g.targetLevel ?? profile.goals.targetLevel,
          targetMarket: g.targetMarket ?? profile.goals.targetMarket,
        },
        updatedAt: new Date(),
      })
      .where(eq(profiles.userId, userId));

    refresh(profile);
    return {
      ok: true,
      message: `Saved to your CV: ${added} new ${added === 1 ? "entry" : "entries"}, ${merged} updated. Review them in Experience.`,
    };
  } catch (err) {
    return fail(err);
  }
}
