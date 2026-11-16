import { mintBrowserToken } from "@/features/interview-prototype/deepgram";
import { listenUrl, speakUrl } from "@/features/interview-prototype/deepgram-urls";
import { disabledResponse, prototypeEnabled } from "@/features/interview-prototype/gate";
import { logFailure, safeMessage } from "@/features/interview-prototype/route-utils";
import { StartRequestSchema, type SessionResponse } from "@/features/interview-prototype/schemas";
import { voiceFor } from "@/features/interview-prototype/voices";
import { planInterview } from "@/lib/ai";

/** Starts an interview: writes the question plan and mints the browser's short-lived Deepgram token. */
export async function POST(request: Request) {
  if (!prototypeEnabled()) return disabledResponse();

  const parsed = StartRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  const { jobDescription, resume, durationMinutes, voice } = parsed.data;

  try {
    const [{ plan, usage }, token] = await Promise.all([
      planInterview({ jobDescription, resume, durationMinutes }),
      // The token only has to be valid when each socket opens, so it lives as long as the interview plus a margin.
      mintBrowserToken(durationMinutes * 60 + 600),
    ]);
    if (plan.questions.length < 3) return Response.json({ error: "The interview plan came back too short. Try again." }, { status: 502 });

    // The voice follows the interview language: the chosen voice's native counterpart in that language.
    const tts = voiceFor(plan.language, voice);
    const body: SessionResponse = {
      plan,
      budgetMs: durationMinutes * 60_000,
      usage,
      deepgram: { token, listenUrl: listenUrl(), speakUrl: speakUrl(tts.model, { speed: tts.speed, expressivity: tts.expressivity }) },
    };
    return Response.json(body);
  } catch (error) {
    logFailure("session", error);
    return Response.json({ error: safeMessage(error, "Could not start the interview. Try again.") }, { status: 502 });
  }
}
