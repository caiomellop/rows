import "server-only";

import { eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { profiles } from "@/db/schema";
import {
  HANDLE_ERROR_MESSAGES,
  handleAlternatives,
  toHandle,
  validateHandle,
} from "@/lib/username";

/** Where onboarding sends the user once the handle is saved. */
export const ONBOARDING_NEXT_PATH = "/discovery";
// MVP-12 (optional repo picker) slots in between the handle and the discovery.

export async function getProfile(userId: string) {
  const [row] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  return row ?? null;
}

/** First candidate no profile owns yet (one query), or null. */
async function firstFreeHandle(candidates: string[]) {
  if (candidates.length === 0) return null;
  const taken = await db
    .select({ username: profiles.username })
    .from(profiles)
    .where(inArray(profiles.username, candidates));
  const takenSet = new Set(taken.map((r) => r.username));
  return candidates.find((c) => !takenSet.has(c)) ?? null;
}

export function suggestAlternative(handle: string) {
  return firstFreeHandle(handleAlternatives(handle));
}

export type HandleCheck =
  | { ok: true }
  | { ok: false; message: string; suggestion: string | null };

/**
 * Validates a (normalized) handle and checks it isn't taken. This lookup is
 * only for friendly feedback: the unique index is what actually guarantees
 * uniqueness when the handle is saved.
 */
export async function checkHandle(handle: string): Promise<HandleCheck> {
  const error = validateHandle(handle);

  if (error === "required" || error === "length" || error === "format") {
    // Offer a cleaned-up version of what they typed, when there is one.
    const cleaned = toHandle(handle);
    const suggestion =
      cleaned && cleaned !== handle && validateHandle(cleaned) === null
        ? await firstFreeHandle([cleaned, ...handleAlternatives(cleaned)])
        : null;
    return { ok: false, message: HANDLE_ERROR_MESSAGES[error], suggestion };
  }

  if (error === "reserved" || (await firstFreeHandle([handle])) === null) {
    return unavailable(handle);
  }

  return { ok: true };
}

export async function unavailable(handle: string): Promise<HandleCheck> {
  return {
    ok: false,
    message: `“${handle}” is unavailable.`,
    suggestion: await suggestAlternative(handle),
  };
}

/** True when `err` is Postgres unique_violation on the given constraint. */
export function isUniqueViolation(err: unknown, constraint: string) {
  // drizzle wraps driver errors in DrizzleQueryError, with the original in `cause`.
  for (let e = err as Record<string, unknown> | undefined; e; ) {
    if (e.code === "23505") {
      return e.constraint_name === constraint || e.constraint === constraint;
    }
    e = e.cause as Record<string, unknown> | undefined;
  }
  return false;
}
