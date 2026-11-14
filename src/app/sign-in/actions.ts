"use server";

import { headers } from "next/headers";

import { requestLoginLink } from "@/lib/login-link";
import { isValidEmail, normalizeEmail } from "@/lib/login-token";

export type SignInState = {
  email: string;
  /** Shown on the field. */
  error?: string;
  /** The address the link went to. */
  sentTo?: string;
};

export async function requestLink(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!isValidEmail(email)) {
    return { email, error: "Enter a valid email address." };
  }

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  try {
    await requestLoginLink(email, ip);
  } catch (err) {
    // Same answer as success: the screen must not reveal anything about the
    // address. The failure is in the server logs.
    console.error("[auth] sending the login link failed:", err);
  }
  return { email, sentTo: email };
}
