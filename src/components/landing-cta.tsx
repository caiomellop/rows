import Link from "next/link";

import { ArrowRight } from "@/components/icons";
import { getSession } from "@/lib/session";

/** Hero CTA (spec §3.1 "Hero CTA"). Reads cookies, so render inside Suspense. */
export async function LandingCta() {
  const user = await getSession();

  if (user) {
    return (
      <Link
        href="/dashboard"
        className="btn-primary group rounded-xl px-6 py-2 text-[0.9rem] leading-relaxed sm:py-2.5 sm:text-[0.95rem]"
      >
        <span>Open your dashboard</span>
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    );
  }

  return (
    <Link
      href="/auth/signin"
      className="btn-primary group rounded-xl px-6 py-2 text-[0.9rem] leading-relaxed sm:py-2.5 sm:text-[0.95rem]"
    >
      <span>Get started</span>
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
