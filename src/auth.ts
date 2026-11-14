import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

import { db } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    GitHub({
      // Default scopes are enough for Phase 0 login.
      // Phase 2 (repo sync) can request additional scopes.
      allowDangerousEmailAccountLinking: false,
    }),
  ],
  session: {
    strategy: "database",
  },
  trustHost: true,
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
});
