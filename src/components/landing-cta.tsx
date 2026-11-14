import Link from "next/link";

import { getSession } from "@/lib/session";

export async function LandingCta() {
  const user = await getSession();

  if (user) {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <p className="text-sm text-ink/70">
          Signed in as <span className="font-medium text-ink">{user.name}</span>
        </p>
        <Link
          href="/auth/logout"
          className="text-sm font-medium text-ink/60 underline-offset-4 hover:text-ink hover:underline"
        >
          Sign out
        </Link>
      </div>
    );
  }

  return (
    <Link
      href="/auth/signin"
      className="inline-flex h-12 items-center justify-center rounded-md bg-accent px-6 text-sm font-semibold text-white transition hover:bg-accent-hover"
    >
      Get Started
    </Link>
  );
}
