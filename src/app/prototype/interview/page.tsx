import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { prototypeEnabled } from "@/features/interview-prototype/gate";
import { InterviewPrototype } from "@/features/interview-prototype/interview-prototype";

export const metadata: Metadata = { title: "Mock interview prototype", robots: { index: false, follow: false } };

/**
 * CAI-36: a single page, no login, no database. It exists only where PROTOTYPE_ENABLED=true.
 * The gate runs per request (connection()), so the flag is read at run time, not frozen at build time.
 */
export default function InterviewPrototypePage() {
  return (
    <Suspense fallback={null}>
      <Gate />
    </Suspense>
  );
}

async function Gate() {
  await connection();
  if (!prototypeEnabled()) notFound();
  return <InterviewPrototype />;
}
