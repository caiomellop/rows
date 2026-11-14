import { eq } from "drizzle-orm";

import { db } from "@/db";
import { profiles } from "@/db/schema";

/**
 * Who may open the public profile of `username`: everyone when it is
 * published, only the owner while it is not. Uncached on purpose, so
 * unpublishing takes effect on the next request.
 */
export async function canViewProfile(username: string, viewerId: string | null): Promise<boolean> {
  const [row] = await db
    .select({ published: profiles.published, userId: profiles.userId })
    .from(profiles)
    .where(eq(profiles.username, username))
    .limit(1);
  if (!row) return false;
  return row.published || row.userId === viewerId;
}
