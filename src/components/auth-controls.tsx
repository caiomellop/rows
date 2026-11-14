import { auth } from "@/auth";
import { signInWithGitHub, signOutAction } from "@/app/actions/auth";

export async function AuthControls() {
  const session = await auth();

  if (!session?.user) {
    return (
      <form action={signInWithGitHub}>
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700"
        >
          Sign in with GitHub
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3">
        {session.user.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- GitHub avatar URL
          <img
            src={session.user.image}
            alt=""
            width={40}
            height={40}
            className="size-10 rounded-full"
          />
        ) : null}
        <div className="text-sm">
          <p className="font-medium text-zinc-900">
            {session.user.name ?? "Signed in"}
          </p>
          <p className="text-zinc-500">{session.user.email}</p>
        </div>
      </div>
      <form action={signOutAction}>
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
