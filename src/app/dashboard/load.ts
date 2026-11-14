import "server-only";

import { profilePath } from "@/lib/profile-url";
import { ensureProfile, getEditorData, requireUser } from "@/lib/dal";

/** Session check + first-visit profile creation + all editor data. */
export async function loadEditor() {
  const user = await requireUser();
  await ensureProfile(user);
  return getEditorData(user.id);
}

export function publicUrl(username: string) {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://rows.so").replace(/\/$/, "");
  return `${base}${profilePath(username)}`;
}
