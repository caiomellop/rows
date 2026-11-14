import { renderToBuffer } from "@react-pdf/renderer";
import type { NextRequest } from "next/server";

import { getContactEmail, getOwnerPreview, getPublicProfile } from "@/lib/dal";
import { parseHandleSegment, profilePath } from "@/lib/profile-url";
import { getSession } from "@/lib/session";

import { ResumeDocument } from "./resume-document";
import { siteUrl } from "@/lib/app-url";

export async function GET(_request: NextRequest, ctx: RouteContext<"/in/[handle]/resume">) {
  const username = parseHandleSegment((await ctx.params).handle);
  if (!username) return new Response("Not found", { status: 404 });
  const session = await getSession();
  const data = (await getPublicProfile(username)) ?? (await getOwnerPreview(username));
  if (!data) return new Response("Not found", { status: 404 });

  const email = await getContactEmail(username, { ownerId: session?.id });
  const profileUrl = `${siteUrl()}${profilePath(data.profile.username)}`;

  const pdf = await renderToBuffer(<ResumeDocument data={data} email={email} profileUrl={profileUrl} />);
  const filename = `${(data.profile.displayName ?? data.profile.username).replace(/[^\w-]+/g, "-")}-resume.pdf`;

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": data.profile.published ? "public, max-age=0, s-maxage=300" : "private, no-store",
    },
  });
}
