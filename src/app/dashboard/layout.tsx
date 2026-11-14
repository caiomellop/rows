import Link from "next/link";
import { Suspense } from "react";

import { DashboardNav } from "@/components/dashboard/nav";
import { Logo } from "@/components/logo";
import { loadEditor } from "@/app/dashboard/load";
import { profilePath } from "@/lib/profile-url";
import { siteHref } from "@/lib/app-url";

// AI drafting and GitHub sync run inside Server Actions on these pages.
export const maxDuration = 60;

async function AccountLinks() {
  // Same cached read as the page below it, so the two share one query batch.
  const { profile } = await loadEditor();
  return (
    <>
      <Link href={siteHref(profilePath(profile.username))} className="text-[14px] text-fg-2 hover:text-fg" prefetch={false}>
        View public page
      </Link>
      <form action="/sign-out" method="post">
        <button type="submit" className="text-[14px] text-fg-2 hover:text-fg">
          Sign out
        </button>
      </form>
    </>
  );
}

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-page/85 backdrop-blur-md">
        <div className="mx-auto flex h-[60px] w-full max-w-[960px] items-center justify-between gap-4 px-4 md:px-6">
          <Logo />
          <div className="flex items-center gap-4">
            <Suspense fallback={<span className="inline-block h-4 w-32 rounded bg-ink/10" />}>
              <AccountLinks />
            </Suspense>
          </div>
        </div>
        <div className="mx-auto w-full max-w-[960px] px-4 pb-2 md:px-6">
          <DashboardNav />
        </div>
      </header>
      <main className="mx-auto w-full max-w-[960px] flex-1 px-4 pb-20 pt-8 md:px-6">{children}</main>
    </div>
  );
}
