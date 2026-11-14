import { Suspense } from "react";

import { AuthControls } from "@/components/auth-controls";
import { HomeIntro } from "@/components/home-intro";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-6 py-16">
      <Suspense
        fallback={
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight">Rows</h1>
            <p className="max-w-xl text-base leading-7 text-zinc-600">
              Loading…
            </p>
          </div>
        }
      >
        <HomeIntro />
      </Suspense>
      <Suspense
        fallback={
          <div className="h-10 w-40 animate-pulse rounded-md bg-zinc-200" />
        }
      >
        <AuthControls />
      </Suspense>
    </main>
  );
}
