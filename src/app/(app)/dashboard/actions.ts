"use server";

import { and, eq, max } from "drizzle-orm";
import mammoth from "mammoth";
import { refresh as refreshRouter, updateTag } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { assistantThreads, experiences, profiles, type AssistantMessage, type WorkMode } from "@/db/schema";
import { AiError, draftSummary, extractFromInterview, interviewReply, parseResume, type ParsedResume } from "@/lib/ai";
import { STARTERS } from "@/config/starters";
import { ensureProfile, getThread, requireUser, userTag } from "@/lib/dal";
import { ROLE_TYPES } from "@/lib/experience-format";

/**
 * Every action re-reads the session and only touches rows the user owns.
 * After a write, `updateTag` drops the cached dashboard data so it re-renders.
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

function refresh(userId: string) {
  updateTag(userTag(userId));
}

/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

function clean(value: FormDataEntryValue | null, maxLength: number): string | null {
  const v = String(value ?? "").trim().slice(0, maxLength);
  return v || null;
}

export async function saveProfile(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const { userId, profile } = await owner();

    const summary = clean(formData.get("summary"), 800);
    const summarySource = String(formData.get("summarySource") ?? "") === "ai" && summary ? "ai" : summary ? "user" : null;
    const workMode = String(formData.get("workMode") ?? "");

    await db
      .update(profiles)
      .set({
        displayName: clean(formData.get("displayName"), 100),
        headline: clean(formData.get("headline"), 120),
        summary,
        summarySource: summary === profile.summary ? profile.summarySource : summarySource,
        location: clean(formData.get("location"), 100),
        timezone: clean(formData.get("timezone"), 60),
        roleTypes: formData.getAll("roleTypes").map(String).filter((r) => (ROLE_TYPES as readonly string[]).includes(r)),
        workMode: (["remote", "hybrid", "onsite", "flexible"].includes(workMode) ? workMode : null) as WorkMode | null,
        workAuthorization: clean(formData.get("workAuthorization"), 120),
        goals: {
          targetRole: clean(formData.get("targetRole"), 100) ?? undefined,
          targetLevel: clean(formData.get("targetLevel"), 60) ?? undefined,
          targetMarket: clean(formData.get("targetMarket"), 100) ?? undefined,
        },
        updatedAt: new Date(),
      })
      .where(eq(profiles.userId, userId));

    refresh(userId);
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
    const experienceRows = await db.select().from(experiences).where(eq(experiences.userId, userId));
    const draft = await draftSummary({ profile, experiences: experienceRows });
    return { ok: true, ...draft };
  } catch (err) {
    const r = fail(err);
    return r.ok ? { ok: false, error: "Something went wrong." } : r;
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

    refresh(userId);
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
    const { userId } = await owner();
    const fields = experienceFields(formData);
    if (!fields.title || !fields.organization) return { ok: false, error: "Add a title and an organization." };

    const id = String(formData.get("id") ?? "");
    if (id) {
      const result = await db
        .update(experiences)
        .set(fields)
        .where(and(eq(experiences.id, id), eq(experiences.userId, userId)))
        .returning({ id: experiences.id });
      if (!result[0]) return { ok: false, error: "Entry not found." };
    } else {
      const [{ top }] = await db.select({ top: max(experiences.position) }).from(experiences).where(eq(experiences.userId, userId));
      await db.insert(experiences).values({ userId, ...fields, source: "manual", position: (top ?? -1) + 1 });
    }

    refresh(userId);
    return { ok: true, message: "Saved." };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteExperience(id: string): Promise<ActionResult> {
  try {
    const { userId } = await owner();
    await db.delete(experiences).where(and(eq(experiences.id, id), eq(experiences.userId, userId)));
    refresh(userId);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/* ------------------------------------------------------------------ */
/* Chat with the AI assistant                                          */
/* ------------------------------------------------------------------ */

async function ownedThread(userId: string, threadId: string) {
  const thread = await getThread(userId, threadId);
  if (!thread) throw new Error("Conversation not found.");
  return thread;
}

async function storeThread(threadId: string, messages: AssistantMessage[]) {
  await db.update(assistantThreads).set({ messages, updatedAt: new Date() }).where(eq(assistantThreads.id, threadId));
}

/** First line of the opening message, shortened for the sidebar. */
function threadTitle(text: string) {
  const line = text.split("\n")[0].trim();
  return line.length > 60 ? `${line.slice(0, 57).trimEnd()}…` : line;
}

async function createThread(text: string, title = threadTitle(text)): Promise<never> {
  const { userId } = await owner();
  const message = text.trim().slice(0, 4000);
  if (!message) redirect("/chat");
  const [row] = await db
    .insert(assistantThreads)
    .values({ userId, title: title || "New chat", messages: [{ role: "user", content: message }] })
    .returning({ id: assistantThreads.id });
  // The thread page asks for the reply, so the new chat opens right away.
  redirect(`/chat/${row.id}`);
}

/** New chat from the composer on /chat. */
export async function startChat(formData: FormData) {
  await createThread(String(formData.get("text") ?? ""));
}

/** New chat from a starter: its prompt is sent as the first message. */
export async function startStarter(starterId: string) {
  const starter = STARTERS.find((s) => s.id === starterId);
  if (!starter) redirect("/chat");
  await createThread(starter.prompt, starter.title);
}

export type ChatResult = { ok: true; messages: AssistantMessage[] } | { ok: false; error: string; messages: AssistantMessage[] };

/** Adds the user's message (if any) and the assistant's reply to a conversation. */
export async function sendChatMessage(threadId: string, text: string): Promise<ChatResult> {
  const { userId, profile } = await owner();
  const thread = await ownedThread(userId, threadId);
  const message = text.trim().slice(0, 4000);
  const messages: AssistantMessage[] = message ? [...thread.messages, { role: "user", content: message }] : thread.messages;

  try {
    const experienceRows = await db.select().from(experiences).where(eq(experiences.userId, userId));
    const reply = await interviewReply({ profile, experiences: experienceRows, messages });
    const next: AssistantMessage[] = [...messages, { role: "assistant", content: reply }];
    await storeThread(threadId, next);
    // The sidebar orders conversations by last activity.
    refreshRouter();
    return { ok: true, messages: next };
  } catch (err) {
    // Keep the user's message so they don't lose what they typed.
    await storeThread(threadId, messages);
    refreshRouter();
    const r = fail(err);
    return { ok: false, error: r.ok ? "Something went wrong." : r.error, messages };
  }
}

export async function setThreadPinned(threadId: string, pinned: boolean): Promise<ActionResult> {
  try {
    const { userId } = await owner();
    await ownedThread(userId, threadId);
    await db.update(assistantThreads).set({ pinned }).where(eq(assistantThreads.id, threadId));
    refreshRouter();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function saveChatToCv(threadId: string): Promise<ActionResult> {
  try {
    const { userId, profile } = await owner();
    const { messages } = await ownedThread(userId, threadId);
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

    refresh(userId);
    return {
      ok: true,
      message: `Saved to your CV: ${added} new ${added === 1 ? "entry" : "entries"}, ${merged} updated. Review them in Resume.`,
    };
  } catch (err) {
    return fail(err);
  }
}
