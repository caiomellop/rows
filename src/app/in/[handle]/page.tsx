import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ProfileView } from "@/components/profile/profile-view";
import { getOwnerPreview, getPublicProfile } from "@/lib/dal";
import { parseHandleSegment, profilePath } from "@/lib/profile-url";

/**
 * Public profile at rows.so/in/@handle.
 *
 * Unknown and unpublished handles get a real HTTP 404 from `src/proxy.ts`,
 * before this page starts streaming (once the shell is sent the status is
 * already 200). The `notFound()` calls here are the fallback for the same cases.
 */

type Props = PageProps<"/in/[handle]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const username = parseHandleSegment((await params).handle);
  const data = username ? await getPublicProfile(username) : null;
  if (!data) return { title: "Rows", robots: { index: false } };

  const name = data.profile.displayName ?? data.profile.username;
  const description = data.profile.summary ?? data.profile.headline ?? `${name}'s portfolio on Rows.`;
  const url = profilePath(data.profile.username);
  return {
    title: `${name}${data.profile.headline ? ` · ${data.profile.headline}` : ""} | Rows`,
    description,
    alternates: { canonical: url },
    openGraph: { title: name, description, type: "profile", url },
    twitter: { card: "summary_large_image", title: name, description },
  };
}

export default function PublicProfilePage({ params }: Props) {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={<ProfileSkeleton />}>
        <Profile params={params} />
      </Suspense>
    </main>
  );
}

async function Profile({ params }: Pick<Props, "params">) {
  const username = parseHandleSegment((await params).handle);
  if (!username) notFound();

  const data = await getPublicProfile(username);
  if (data) return <ProfileView data={data} />;

  // Unpublished: the owner can still preview it.
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <OwnerPreview username={username} />
    </Suspense>
  );
}

async function OwnerPreview({ username }: { username: string }) {
  const preview = await getOwnerPreview(username);
  if (!preview) notFound();
  return <ProfileView data={preview} preview />;
}

function ProfileSkeleton() {
  return (
    <div aria-busy className="mx-auto w-full max-w-[860px] px-4 pt-12 md:px-6">
      <div className="surface h-72 animate-pulse" />
      <div className="surface mt-10 h-48 animate-pulse" />
    </div>
  );
}
