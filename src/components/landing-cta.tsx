import Link from "next/link";

import { getSession } from "@/lib/session";

/** Hero CTA only — nav auth lives in `SiteNav`. */
export async function LandingCta() {
  const user = await getSession();

  if (user) {
    return (
      <p className="text-[15px] text-ink/65">
        Signed in as <span className="font-medium text-ink">{user.name}</span>
      </p>
    );
  }

  return (
    <Link
      href="/auth/signin"
      className="inline-flex h-12 items-center justify-center rounded-full bg-ink px-7 text-[15px] font-medium tracking-[-0.01em] text-paper transition hover:bg-ink/88"
    >
      Get Started
    </Link>
  );
}
