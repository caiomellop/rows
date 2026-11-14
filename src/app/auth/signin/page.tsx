import { redirect } from "next/navigation";
import { Suspense } from "react";

import { SignInForm } from "@/components/sign-in-form";
import { getSession } from "@/lib/session";

async function SignInBody({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getSession();
  if (user) {
    redirect("/");
  }

  const { error } = await searchParams;

  return <SignInForm oauthError={error} />;
}

export default function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <main className="relative flex min-h-full flex-1 flex-col bg-[#f3f2ef]">
      <Suspense
        fallback={
          <div className="flex min-h-full flex-1 flex-col items-center justify-center px-6 py-16">
            <div className="h-11 w-11 animate-pulse rounded-full bg-ink/10" />
            <div className="mt-7 h-8 w-40 animate-pulse rounded bg-ink/10" />
            <div className="mt-3 h-5 w-56 animate-pulse rounded bg-ink/10" />
          </div>
        }
      >
        <SignInBody searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
