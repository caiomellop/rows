import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { getSession } from "@/lib/session";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#experiences", label: "Experiences" },
  { href: "#pricing", label: "Pricing" },
  { href: "#help", label: "Help" },
] as const;

async function NavActions() {
  const user = await getSession();

  if (user) {
    return (
      <div className="flex items-center gap-5 sm:gap-6">
        <p className="hidden text-[14px] text-ink/55 sm:block">
          <span className="font-medium text-ink">{user.name}</span>
        </p>
        <Link
          href="/auth/logout"
          className="text-[14px] font-medium text-ink/55 transition hover:text-ink"
        >
          Sign out
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-5 sm:gap-6">
      <Link
        href="/auth/signin"
        className="text-[14px] font-medium text-ink/55 transition hover:text-ink"
      >
        Sign in
      </Link>
      <Link
        href="/auth/signin"
        className="inline-flex h-9 items-center justify-center rounded-full bg-ink px-4 text-[13.5px] font-medium tracking-[-0.01em] text-paper transition hover:bg-ink/88 sm:h-10 sm:px-5 sm:text-sm"
      >
        Get Started
      </Link>
    </div>
  );
}

export function SiteNav() {
  return (
    <header className="anim-nav mx-auto flex w-full max-w-6xl items-center justify-between px-6 pt-6 sm:px-8 sm:pt-7">
      <Link href="/" className="flex shrink-0 items-center gap-2.5">
        <Image
          src="/brand/rows-mark.png"
          alt=""
          width={28}
          height={28}
          className="h-7 w-7 rounded-[6px] object-cover"
          priority
        />
        <span className="font-[family-name:var(--font-geist)] text-[1.3rem] font-semibold tracking-[-0.04em] text-ink">
          Rows
        </span>
      </Link>

      <nav
        aria-label="Primary"
        className="flex items-center gap-6 sm:gap-7 lg:gap-8"
      >
        <ul className="hidden items-center gap-6 md:flex lg:gap-7">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-[14px] font-medium text-ink/55 transition hover:text-ink"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <Suspense
          fallback={
            <span className="inline-flex h-10 w-40 animate-pulse rounded-full bg-ink/10" />
          }
        >
          <NavActions />
        </Suspense>
      </nav>
    </header>
  );
}
