import { getSession } from "@/lib/session";

export async function AuthControls() {
  const user = await getSession();

  if (!user) {
    return (
      <a
        href="/auth/login"
        className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700"
      >
        Sign in with GitHub
      </a>
    );
  }

  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3">
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- GitHub avatar URL
          <img
            src={user.image}
            alt=""
            width={40}
            height={40}
            className="size-10 rounded-full"
          />
        ) : null}
        <div className="text-sm">
          <p className="font-medium text-zinc-900">{user.name ?? "Signed in"}</p>
          <p className="text-zinc-500">{user.email}</p>
        </div>
      </div>
      <form action="/auth/logout" method="post">
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-md border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
