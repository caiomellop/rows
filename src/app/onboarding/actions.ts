"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { profiles } from "@/db/schema";
import { requireUser } from "@/lib/dal";
import { HANDLE_ERROR_MESSAGES, normalizeHandleInput, validateHandle } from "@/lib/username";

export type ClaimHandleState = { handle: string; error?: string };

const TAKEN = "This handle is unavailable.";

/** First access: the user picks their unique handle, which creates the profile. */
export async function claimHandle(_prev: ClaimHandleState, formData: FormData): Promise<ClaimHandleState> {
  const user = await requireUser();
  const handle = normalizeHandleInput(String(formData.get("handle") ?? ""));

  const invalid = validateHandle(handle);
  if (invalid) return { handle, error: HANDLE_ERROR_MESSAGES[invalid] };

  const [taken] = await db.select({ id: profiles.userId }).from(profiles).where(eq(profiles.username, handle)).limit(1);
  if (taken) return { handle, error: TAKEN };

  // The unique index on username settles a race between two people; the
  // primary key on userId makes a double submit a no-op.
  let created: { userId: string }[];
  try {
    created = await db
      .insert(profiles)
      .values({ userId: user.id, username: handle, displayName: user.name })
      .onConflictDoNothing()
      .returning({ userId: profiles.userId });
  } catch (err) {
    console.error("[onboarding] saving the handle failed:", err);
    return { handle, error: "We couldn't save your handle. Please try again." };
  }

  if (!created.length) {
    const [mine] = await db.select({ id: profiles.userId }).from(profiles).where(eq(profiles.userId, user.id)).limit(1);
    if (!mine) return { handle, error: TAKEN };
  }
  redirect("/dashboard");
}
