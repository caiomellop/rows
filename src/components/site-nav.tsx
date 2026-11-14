import Link from "next/link";
import { Suspense } from "react";

import { Logo } from "@/components/logo";
import { getSession } from "@/lib/session";

const navLink =
  "text-[15px] text-fg-2 transition-colors hover:text-fg";

/** Sign-in state lives behind Suspense because it reads cookies. */
async function NavAccount() {
  const user = await getSession();

  if (user) {
    return (
      <>
        {/* A POST form, not a <Link>: Next.js prefetches links in production,
            and prefetching a GET that clears the cookie signs the user out. */}
        <form action="/auth/logout" method="post" className="hidden sm:block">
          <button type="submit" className={`${navLink} cursor-pointer`}>
            Sign out
          </button>
        </form>
        <Link
          href="/dashboard"
          className="btn-primary h-[38px] rounded-xl px-5 text-[15px]"
        >
          Dashboard
        </Link>
      </>
    );
  }

  return (
    <>
      <Link href="/auth/signin" className={`${navLink} hidden sm:inline`}>
        Sign in
      </Link>
      <Link
        href="/auth/signin"
        className="btn-primary h-[38px] rounded-xl px-5 text-[15px]"
      >
        Get started
      </Link>
    </>
  );
}

/** Spec §4: full-width, ~66px, hairline bottom border, sticky with blur. */
export function SiteNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-page/80 backdrop-blur-md">
      <div className="flex h-[66px] items-center justify-between px-5 md:px-8">
        <Logo />
        <nav aria-label="Main" className="flex items-center gap-5">
          <Link href="/" className={`${navLink} hidden sm:inline`}>
            Product
          </Link>
          <Link href="/pricing" className={navLink}>
            Pricing
          </Link>
          <Suspense
            fallback={
              <span className="inline-block h-[38px] w-[110px] rounded-xl bg-ink/10" />
            }
          >
            <NavAccount />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}
