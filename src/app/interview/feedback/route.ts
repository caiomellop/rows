import { disabledResponse, prototypeEnabled } from "@/features/interview-prototype/gate";
import { logFailure, safeMessage } from "@/features/interview-prototype/route-utils";
import { FeedbackRequestSchema, type FeedbackResponseSchema } from "@/features/interview-prototype/schemas";
import { interviewFeedback } from "@/lib/ai";
import type { z } from "zod";

/** The feedback report. It has no latency pressure, so the browser asks for it after the interview and waits. */
export async function POST(request: Request) {
  if (!prototypeEnabled()) return disabledResponse();

  const parsed = FeedbackRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });

  try {
    const result: z.infer<typeof FeedbackResponseSchema> = await interviewFeedback(parsed.data);
    return Response.json(result);
  } catch (error) {
    logFailure("feedback", error);
    return Response.json({ error: safeMessage(error, "Could not write the feedback. Try again.") }, { status: 502 });
  }
}
