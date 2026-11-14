import Link from "next/link";

import { Logo } from "@/components/logo";

export default function ProfileNotFound() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <div
        aria-hidden
        className="dot-grid dot-grid-center pointer-events-none absolute inset-0 -z-10"
      />
      <Logo />
      <h1 className="mt-10 text-[2.4rem] leading-[1.05] text-fg-2">
        No profile <span className="text-accent">here yet.</span>
      </h1>
      <p className="mt-3 max-w-sm font-geist text-base leading-7 text-fg-2">
        This username isn&apos;t taken, or its owner hasn&apos;t published their profile.
      </p>
      <Link href="/auth/signin" className="btn-primary mt-8 h-11 rounded-xl px-5 text-[0.95rem]">
        Claim your profile
      </Link>
    </main>
  );
}
