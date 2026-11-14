"use server";

import { redirect } from "next/navigation";

import { consumeLoginToken, findOrCreateUserByEmail, peekLoginToken } from "@/lib/login-link";
import { expiredLinkUrl } from "@/lib/login-token";
import { startSession } from "@/lib/session";

/** The only place a login token is spent: the POST behind the "Log in" button. */
export async function confirmLogin(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const email = token ? await consumeLoginToken(token) : null;
  if (!email) {
    const { email: known } = token ? await peekLoginToken(token) : { email: null };
    redirect(expiredLinkUrl(known));
  }

  const { user, needsOnboarding } = await findOrCreateUserByEmail(email);
  await startSession(user);
  redirect(needsOnboarding ? "/onboarding" : "/chat");
}
