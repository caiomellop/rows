import "server-only";

import { AiError } from "@/lib/ai";

import { DeepgramError } from "./deepgram";

/** A message that is safe to show: one of ours, never a raw provider error or a stack trace. */
export function safeMessage(error: unknown, fallback: string): string {
  return error instanceof AiError || error instanceof DeepgramError ? error.message : fallback;
}

/** Logs the kind of failure only. Transcripts and job descriptions are personal data and stay out of the logs. */
export function logFailure(route: string, error: unknown) {
  console.error(`[interview-prototype] ${route} failed:`, error instanceof Error ? error.name : "unknown error");
}
