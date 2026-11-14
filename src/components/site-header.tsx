import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { LandingCta } from "@/components/landing-cta";

export function SiteHeader({ active }: { active?: "pricing" | "home" }) {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 pt-7 sm:px-8 sm:pt-8">
      <div className="flex items-center gap-8">
        <Link href="/" className="group flex items-center gap-2.5">
          <Image
            src="/brand/rows-mark.png"
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 rounded-sm object-cover"
            priority
          />
          <span className="font-[family-name:var(--font-geist)] text-[1.35rem] font-semibold tracking-[-0.04em] text-ink">
            Rows
          </span>
        </Link>

        <nav className="hidden items-center gap-5 sm:flex">
          <Link
            href="/pricing"
            className={
              active === "pricing"
                ? "text-sm font-medium tracking-[-0.01em] text-ink"
                : "text-sm font-medium tracking-[-0.01em] text-ink/55 transition hover:text-ink"
            }
          >
            Pricing
          </Link>
        </nav>
      </div>

      <div className="flex items-center gap-4">
        <Link
          href="/pricing"
          className="text-sm font-medium text-ink/55 transition hover:text-ink sm:hidden"
        >
          Pricing
        </Link>
        <Suspense
          fallback={
            <span className="inline-flex h-10 w-28 animate-pulse rounded-full bg-ink/10" />
          }
        >
          <LandingCta variant="nav" />
        </Suspense>
      </div>
    </header>
  );
}
