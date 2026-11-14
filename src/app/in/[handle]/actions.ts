"use server";

import { getContactEmail } from "@/lib/dal";

/** Reveals the contact email on click, so it isn't sitting in the HTML for scrapers. */
export async function revealContact(username: string): Promise<string | null> {
  if (typeof username !== "string" || username.length > 40) return null;
  return getContactEmail(username);
}
