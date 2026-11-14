import type { Metadata } from "next";

import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Privacy Policy | Rows" };

/** Placeholder: the legal text is still to be written (out of scope for MVP-23). */
export default function Page() {
  return (
    <main className="mx-auto w-full max-w-[680px] flex-1 px-6 py-16">
      <Logo />
      <h1 className="mt-10 text-[2.4rem] leading-[1.1] text-fg">Privacy Policy</h1>
      <p className="mt-6 text-[17px] leading-relaxed text-fg-2">
        This page is being written.
      </p>
    </main>
  );
}
