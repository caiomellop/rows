"use server";

import { and, asc, eq, inArray, max, ne } from "drizzle-orm";
import { refresh, updateTag } from "next/cache";

import { db } from "@/db";
import { experienceProjects, experiences, projects, users } from "@/db/schema";
import { isMonth } from "@/lib/dates";
import { GithubSyncError, syncGithubRepos } from "@/lib/github-sync";
import { profileTag, requireUserId } from "@/lib/portfolio";
import { normalizeUsername, validateUsername } from "@/lib/username";

export type FormState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
  /** What was submitted, echoed back on failure so the form keeps the input. */
  values?: Record<string, string | string[]>;
};

function fail(errors: Record<string, string>, formData: FormData): FormState {
  const values: Record<string, string | string[]> = {};
  for (const key of new Set(formData.keys())) {
    if (key.startsWith("$")) continue; // React's internal action fields
    const all = formData.getAll(key).map(String);
    values[key] = key === "projectIds" ? all : all[0];
  }
  return { errors, values };
}

// Every action here is a public POST endpoint: each one re-reads the session
// and scopes every query to the signed-in user's rows.

/** Expire the public page and re-render the dashboard. */
async function invalidate(userId: string, ...extraUsernames: (string | null)[]) {
  const [row] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  for (const username of new Set([row?.username, ...extraUsernames])) {
    if (username) updateTag(profileTag(username));
  }
  refresh();
}

function text(formData: FormData, key: string, maxLength: number) {
  const value = String(formData.get(key) ?? "").trim();
  return { value: value || null, tooLong: value.length > maxLength };
}

function normalizeUrl(raw: string | null): string | null | undefined {
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    return url.hostname.includes(".") ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/* ---------------------------------------------------------------- Profile */

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const errors: Record<string, string> = {};

  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const usernameError = validateUsername(username);
  if (usernameError) errors.username = usernameError;

  const name = text(formData, "name", 80);
  const headline = text(formData, "headline", 140);
  const about = text(formData, "about", 4000);
  const location = text(formData, "location", 80);
  const websiteRaw = text(formData, "website", 200);

  if (name.tooLong) errors.name = "Keep it under 80 characters.";
  if (headline.tooLong) errors.headline = "Keep it under 140 characters.";
  if (about.tooLong) errors.about = "Keep it under 4,000 characters.";
  if (location.tooLong) errors.location = "Keep it under 80 characters.";
  const website = normalizeUrl(websiteRaw.value);
  if (websiteRaw.tooLong || website === undefined) errors.website = "Enter a valid link.";

  if (!errors.username) {
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.username, username), ne(users.id, userId)))
      .limit(1);
    if (taken) errors.username = "That username is taken.";
  }

  if (Object.keys(errors).length > 0) return fail(errors, formData);

  const [before] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  try {
    await db
      .update(users)
      .set({
        username,
        name: name.value,
        headline: headline.value,
        about: about.value,
        location: location.value,
        website: website ?? null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  } catch {
    // Lost a race for the username against another sign-up.
    return fail({ username: "That username is taken." }, formData);
  }

  await invalidate(userId, before?.username ?? null);
  return { ok: true, message: "Profile saved." };
}

export async function setPublished(published: boolean) {
  const userId = await requireUserId();
  await db.update(users).set({ published, updatedAt: new Date() }).where(eq(users.id, userId));
  await invalidate(userId);
}

/* --------------------------------------------------------------- Projects */

export async function syncRepos(): Promise<FormState> {
  const userId = await requireUserId();
  try {
    const { count } = await syncGithubRepos(userId);
    await invalidate(userId);
    return { ok: true, message: `Synced ${count} public ${count === 1 ? "repo" : "repos"}.` };
  } catch (err) {
    if (err instanceof GithubSyncError) return { message: err.message };
    console.error("GitHub sync failed", err);
    return { message: "Sync failed. Try again in a minute." };
  }
}

async function ownProject(userId: string, projectId: string) {
  const [row] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function toggleProjectVisible(projectId: string) {
  const userId = await requireUserId();
  const project = await ownProject(userId, projectId);
  if (!project) return;
  await db
    .update(projects)
    // Hiding a project also unpins it, so pins only hold what visitors can see.
    .set({ visible: !project.visible, pinned: project.visible ? false : project.pinned })
    .where(eq(projects.id, projectId));
  await invalidate(userId);
}

export async function toggleProjectPinned(projectId: string) {
  const userId = await requireUserId();
  const project = await ownProject(userId, projectId);
  if (!project) return;

  if (project.pinned) {
    await db.update(projects).set({ pinned: false }).where(eq(projects.id, projectId));
  } else {
    const [{ top }] = await db
      .select({ top: max(projects.position) })
      .from(projects)
      .where(and(eq(projects.userId, userId), eq(projects.pinned, true)));
    await db
      .update(projects)
      .set({ pinned: true, visible: true, position: (top ?? -1) + 1 })
      .where(eq(projects.id, projectId));
  }
  await invalidate(userId);
}

/** Moves a pinned project one slot up or down among the pinned ones. */
export async function moveProject(projectId: string, direction: "up" | "down") {
  const userId = await requireUserId();
  const pinned = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.userId, userId), eq(projects.pinned, true)))
    .orderBy(asc(projects.position));

  const from = pinned.findIndex((p) => p.id === projectId);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= pinned.length) return;

  const order = pinned.map((p) => p.id);
  [order[from], order[to]] = [order[to], order[from]];

  // Rewrite positions densely, which also repairs any gaps or ties.
  await db.transaction(async (tx) => {
    for (const [position, id] of order.entries()) {
      await tx.update(projects).set({ position }).where(eq(projects.id, id));
    }
  });
  await invalidate(userId);
}

export async function createProject(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const errors: Record<string, string> = {};

  const name = text(formData, "name", 100);
  const description = text(formData, "description", 400);
  const urlRaw = text(formData, "url", 200);

  if (!name.value) errors.name = "Give it a name.";
  if (name.tooLong) errors.name = "Keep it under 100 characters.";
  if (description.tooLong) errors.description = "Keep it under 400 characters.";
  const url = normalizeUrl(urlRaw.value);
  if (urlRaw.tooLong || url === undefined) errors.url = "Enter a valid link.";

  if (Object.keys(errors).length > 0) return fail(errors, formData);

  await db.insert(projects).values({
    userId,
    source: "manual",
    name: name.value!,
    description: description.value,
    url: url ?? null,
    pushedAt: new Date(),
  });
  await invalidate(userId);
  return { ok: true, message: "Project added." };
}

/** Only hand-added projects can be deleted; synced repos are hidden instead. */
export async function deleteProject(projectId: string) {
  const userId = await requireUserId();
  await db
    .delete(projects)
    .where(
      and(eq(projects.id, projectId), eq(projects.userId, userId), eq(projects.source, "manual")),
    );
  await invalidate(userId);
}

/* ------------------------------------------------------------ Experiences */

export async function saveExperience(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const errors: Record<string, string> = {};

  const id = String(formData.get("id") ?? "") || null;
  const role = text(formData, "role", 100);
  const company = text(formData, "company", 100);
  const location = text(formData, "location", 80);
  const description = text(formData, "description", 2000);
  const startDate = String(formData.get("startDate") ?? "");
  const current = formData.get("current") === "on";
  const endDate = current ? null : String(formData.get("endDate") ?? "") || null;

  if (!role.value) errors.role = "Add your role.";
  if (role.tooLong) errors.role = "Keep it under 100 characters.";
  if (!company.value) errors.company = "Add the company or organization.";
  if (company.tooLong) errors.company = "Keep it under 100 characters.";
  if (location.tooLong) errors.location = "Keep it under 80 characters.";
  if (description.tooLong) errors.description = "Keep it under 2,000 characters.";
  if (!isMonth(startDate)) errors.startDate = "Pick a start month.";
  if (!current && !endDate) errors.endDate = "Pick an end month, or mark it as current.";
  if (endDate && !isMonth(endDate)) errors.endDate = "Pick an end month.";
  if (endDate && isMonth(startDate) && endDate < startDate) {
    errors.endDate = "The end can't be before the start.";
  }

  if (Object.keys(errors).length > 0) return fail(errors, formData);

  // Only link projects this user owns.
  const requested = formData.getAll("projectIds").map(String);
  const projectIds =
    requested.length > 0
      ? (
          await db
            .select({ id: projects.id })
            .from(projects)
            .where(and(eq(projects.userId, userId), inArray(projects.id, requested)))
        ).map((p) => p.id)
      : [];

  const values = {
    role: role.value!,
    company: company.value!,
    location: location.value,
    description: description.value,
    startDate,
    endDate,
    updatedAt: new Date(),
  };

  const saved = await db.transaction(async (tx) => {
    let experienceId: string;
    if (id) {
      const updated = await tx
        .update(experiences)
        .set(values)
        .where(and(eq(experiences.id, id), eq(experiences.userId, userId)))
        .returning({ id: experiences.id });
      if (updated.length === 0) return false;
      experienceId = id;
      await tx.delete(experienceProjects).where(eq(experienceProjects.experienceId, id));
    } else {
      const [created] = await tx
        .insert(experiences)
        .values({ ...values, userId })
        .returning({ id: experiences.id });
      experienceId = created.id;
    }
    if (projectIds.length > 0) {
      await tx
        .insert(experienceProjects)
        .values(projectIds.map((projectId) => ({ experienceId, projectId })));
    }
    return true;
  });

  if (!saved) return { message: "That experience no longer exists." };
  await invalidate(userId);
  return { ok: true, message: id ? "Experience updated." : "Experience added." };
}

export async function deleteExperience(experienceId: string) {
  const userId = await requireUserId();
  await db
    .delete(experiences)
    .where(and(eq(experiences.id, experienceId), eq(experiences.userId, userId)));
  await invalidate(userId);
}
