import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

import { db } from "@/db";
import { accounts, users, verificationTokens } from "@/db/schema";

const authSecret =
  process.env.AUTH_GITHUB_SECRET ??
  // Allow `next build` when Preview env vars are not yet set.
  (process.env.NEXT_PHASE === "phase-production-build"
    ? "build-placeholder-secret"
    : undefined);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    GitHub({
      // Default scopes are enough for Phase 0 login.
      // Phase 2 (repo sync) can request additional scopes.
      allowDangerousEmailAccountLinking: false,
    }),
  ],
  // Reuse GitHub client secret as Auth.js signing secret (no separate AUTH_SECRET).
  secret: authSecret,
  // JWT sessions avoid a DB round-trip on every page load (better on Vercel).
  // The Drizzle adapter still create/updates `users` + `accounts` on GitHub sign-in.
  session: {
    strategy: "jwt",
  },
  trustHost: true,
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
