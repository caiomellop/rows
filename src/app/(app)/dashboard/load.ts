import "server-only";

import { profilePath } from "@/lib/profile-url";
import { ensureProfile, getEditorData, requireUser } from "@/lib/dal";
import { siteUrl } from "@/lib/app-url";

/** Session check + profile (or a redirect to onboarding), for pages that need nothing else. */
export async function loadViewer() {
  const user = await requireUser();
  const profile = await ensureProfile(user);
  return { user, profile };
}

/** Session check + first-visit profile creation + all editor data. */
export async function loadEditor() {
  const user = await requireUser();
  await ensureProfile(user);
  return getEditorData(user.id);
}

export function publicUrl(username: string) {
  return `${siteUrl()}${profilePath(username)}`;
}
