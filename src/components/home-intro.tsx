import { auth } from "@/auth";

export async function HomeIntro() {
  const session = await auth();

  return (
    <div className="space-y-3">
      <h1 className="text-3xl font-semibold tracking-tight">
        {session?.user ? "You're signed in" : "Welcome to Rows"}
      </h1>
      <p className="max-w-xl text-base leading-7 text-zinc-600">
        {session?.user
          ? "Your GitHub account is linked. A user row was created or updated in Postgres on login."
          : "Sign in with GitHub to create your account. Phase 0 wires Auth.js, Drizzle, and Supabase Postgres."}
      </p>
    </div>
  );
}
