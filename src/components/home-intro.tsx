import { getSession } from "@/lib/session";

export async function HomeIntro() {
  const user = await getSession();

  return (
    <div className="space-y-3">
      <h1 className="text-3xl font-semibold tracking-tight">
        {user ? "You're signed in" : "Welcome to Rows"}
      </h1>
      <p className="max-w-xl text-base leading-7 text-zinc-600">
        {user
          ? "Your GitHub account is linked. A user row was created or updated in Postgres on login."
          : "Sign in with GitHub to create your account."}
      </p>
    </div>
  );
}
