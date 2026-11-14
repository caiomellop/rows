import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PortfolioView } from "@/components/portfolio-view";
import { getPublicPortfolio } from "@/lib/portfolio";
import { normalizeUsername } from "@/lib/username";

export async function generateMetadata({
  params,
}: PageProps<"/u/[username]">): Promise<Metadata> {
  const { username } = await params;
  const portfolio = await getPublicPortfolio(normalizeUsername(username));
  if (!portfolio) return { title: "Profile not found · Rows" };

  const { profile } = portfolio;
  const name = profile.name ?? profile.username ?? "Developer";
  const description =
    profile.headline ?? profile.about?.slice(0, 160) ?? `${name}'s portfolio on Rows.`;
  return {
    title: `${name} · Rows`,
    description,
    openGraph: {
      title: name,
      description,
      type: "profile",
      images: profile.image ? [{ url: profile.image }] : undefined,
    },
  };
}

/** Awaits params inside the boundary so unknown usernames still get the App Shell. */
async function Profile({ params }: Pick<PageProps<"/u/[username]">, "params">) {
  const { username } = await params;
  const portfolio = await getPublicPortfolio(normalizeUsername(username));
  if (!portfolio) notFound();
  return <PortfolioView portfolio={portfolio} />;
}

function ProfileSkeleton() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-[760px] flex-1 px-5 pt-[clamp(48px,9vh,96px)] md:px-8">
      <div className="size-[76px] animate-pulse rounded-full bg-ink/[0.07]" />
      <div className="mt-6 h-11 w-64 animate-pulse rounded-lg bg-ink/[0.07]" />
      <div className="mt-4 h-5 w-96 max-w-full animate-pulse rounded bg-ink/[0.05]" />
      <div className="mt-14 grid gap-3.5 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-[18px] bg-ink/[0.04]" />
        ))}
      </div>
    </div>
  );
}

export default function PublicProfilePage({ params }: PageProps<"/u/[username]">) {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <Profile params={params} />
    </Suspense>
  );
}
