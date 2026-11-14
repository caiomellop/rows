import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { redirect } from "next/navigation";

import { profilePath } from "@/lib/profile-url";
import { ensureProfile, getEditorData, requireUser, userTag } from "@/lib/dal";
import { getSession } from "@/lib/session";
import { siteUrl } from "@/lib/app-url";

/** Session check + profile (or a redirect to onboarding), for pages that need nothing else. */
export async function loadViewer() {
  const user = await requireUser();
  const profile = await ensureProfile(user);
  return { user, profile };
}

/**
 * The signed-in user's editor data, or null when there is no valid session.
 *
 * "use cache: private" keeps the result in the user's own browser only; it is
 * never stored on the server. With a stale time of five minutes Next.js
 * includes it in the App Shell it prefetches for each dashboard tab, so
 * switching tabs renders at once instead of waiting for the database.
 *
 * The session check has to sit inside the cached scope: verifying the cookie's
 * signature is async work, and outside a cache it ends the prefetch at the
 * loading skeleton. Every dashboard action calls `updateTag(userTag(...))`,
 * which drops this entry, so edits show up immediately.
 */
async function editorData() {
  "use cache: private";
  cacheLife({ stale: 300 });

  const user = await getSession();
  if (!user) return null;
  cacheTag(userTag(user.id));
  return getEditorData(user.id);
}

/** Session check + all editor data. Signed-out users and users without a profile are redirected. */
export async function loadEditor() {
  const data = await editorData();
  if (!data) redirect("/sign-in");
  const { profile, ...rest } = data;
  if (!profile) redirect("/onboarding");
  return { profile, ...rest };
}

export function publicUrl(username: string) {
  return `${siteUrl()}${profilePath(username)}`;
}
