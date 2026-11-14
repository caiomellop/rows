"use server";

import { isNull } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { profiles } from "@/db/schema";
import {
  ONBOARDING_NEXT_PATH,
  checkHandle,
  isUniqueViolation,
  unavailable,
} from "@/lib/profile";
import { getSession } from "@/lib/session";
import { normalizeHandleInput } from "@/lib/username";

export type ClaimHandleState = {
  handle: string;
  error?: string;
  suggestion?: string | null;
};

/** Saves the chosen handle, then moves on to the next onboarding step. */
export async function claimHandle(
  _prev: ClaimHandleState,
  formData: FormData,
): Promise<ClaimHandleState> {
  const user = await getSession();
  if (!user) redirect("/auth/signin");

  const handle = normalizeHandleInput(String(formData.get("handle") ?? ""));

  const check = await checkHandle(handle);
  if (!check.ok) {
    return { handle, error: check.message, suggestion: check.suggestion };
  }

  try {
    // Only sets the handle while it is still empty: changing an existing
    // handle is account management (MVP-07), not onboarding.
    await db
      .insert(profiles)
      .values({ userId: user.id, username: handle })
      .onConflictDoUpdate({
        target: profiles.userId,
        set: { username: handle, updatedAt: new Date() },
        setWhere: isNull(profiles.username),
      });
  } catch (err) {
    // Someone claimed it between the check and the insert.
    if (isUniqueViolation(err, "profiles_username_unique")) {
      const taken = await unavailable(handle);
      return {
        handle,
        error: taken.ok ? undefined : taken.message,
        suggestion: taken.ok ? null : taken.suggestion,
      };
    }
    console.error("[onboarding] saving handle failed:", err);
    return { handle, error: "We couldn't save your handle. Please try again." };
  }

  redirect(ONBOARDING_NEXT_PATH);
}
