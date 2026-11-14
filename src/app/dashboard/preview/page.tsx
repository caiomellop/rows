import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PortfolioView } from "@/components/portfolio-view";
import { getOwnPortfolio, toPublicView } from "@/lib/portfolio";

export const metadata: Metadata = {
  title: "Preview · Rows",
  robots: { index: false },
};

/** The owner's portfolio exactly as visitors will see it, published or not. */
async function Preview() {
  const portfolio = toPublicView(await getOwnPortfolio());
  const { published, username } = portfolio.profile;

  return (
    <>
      <div className="sticky top-0 z-50 border-b border-line bg-page/85 backdrop-blur-md">
        <div className="flex h-12 items-center justify-between gap-4 px-5 text-[13px] md:px-8">
          <p className="text-fg-2">
            <span className="font-medium text-fg">Preview.</span>{" "}
            {published ? "This is live for everyone." : "Only you can see this until you publish."}
          </p>
          <div className="flex items-center gap-4">
            {published && username ? (
              <Link href={`/u/${username}`} className="hidden font-medium text-fg-2 hover:text-fg sm:inline">
                Open live page
              </Link>
            ) : null}
            <Link href="/dashboard" className="btn-secondary h-8 rounded-lg px-3 text-[13px]">
              Back to editing
            </Link>
          </div>
        </div>
      </div>
      <PortfolioView portfolio={portfolio} />
    </>
  );
}

export default function PreviewPage() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <Preview />
    </Suspense>
  );
}
