import Link from "next/link";

import { getSession } from "@/lib/session";

export async function LandingCta({
  variant = "hero",
}: {
  variant?: "hero" | "nav";
}) {
  const user = await getSession();

  if (user) {
    if (variant === "nav") {
      return (
        <div className="flex items-center gap-4">
          <p className="hidden text-sm text-ink/60 sm:block">
            <span className="font-medium text-ink">{user.name}</span>
          </p>
          <Link
            href="/auth/logout"
            className="text-sm font-medium text-ink/55 underline-offset-4 transition hover:text-ink hover:underline"
          >
            Sign out
          </Link>
        </div>
      );
    }

    return (
      <p className="text-[15px] text-ink/65">
        Signed in as <span className="font-medium text-ink">{user.name}</span>
      </p>
    );
  }

  return (
    <Link
      href="/auth/signin"
      className={
        variant === "nav"
          ? "inline-flex h-10 items-center justify-center rounded-full bg-ink px-5 text-sm font-medium tracking-[-0.01em] text-paper transition hover:bg-ink/88"
          : "inline-flex h-12 items-center justify-center rounded-full bg-ink px-7 text-[15px] font-medium tracking-[-0.01em] text-paper transition hover:bg-ink/88"
      }
    >
      Get Started
    </Link>
  );
}
