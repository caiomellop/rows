import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ProfileView } from "@/components/profile/profile-view";
import { getOwnerPreview, getPublicProfile } from "@/lib/dal";

export async function generateMetadata({ params }: PageProps<"/u/[username]">): Promise<Metadata> {
  const { username } = await params;
  const data = await getPublicProfile(username);
  if (!data) return { title: "Rows", robots: { index: false } };

  const name = data.profile.displayName ?? data.profile.username;
  const description = data.profile.summary ?? data.profile.headline ?? `${name}'s portfolio on Rows.`;
  return {
    title: `${name}${data.profile.headline ? ` · ${data.profile.headline}` : ""} | Rows`,
    description,
    openGraph: { title: name, description, type: "profile", url: `/u/${data.profile.username}` },
    twitter: { card: "summary_large_image", title: name, description },
  };
}

export default function PublicProfilePage({ params }: PageProps<"/u/[username]">) {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={<ProfileSkeleton />}>
        <Profile params={params} />
      </Suspense>
    </main>
  );
}

async function Profile({ params }: Pick<PageProps<"/u/[username]">, "params">) {
  const { username } = await params;
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
