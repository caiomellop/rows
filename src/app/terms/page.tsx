import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-2xl flex-1 flex-col px-6 py-16">
      <Link href="/" className="text-sm text-ink/55 hover:text-ink">
        ← Rows
      </Link>
      <h1 className="mt-8 text-3xl font-semibold tracking-tight text-ink">Terms</h1>
      <p className="mt-4 text-base leading-7 text-ink/65">
        Placeholder terms for Rows. Full terms will be published before public launch.
      </p>
    </main>
  );
}
