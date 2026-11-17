import { mintBrowserToken } from "@/features/interview-prototype/deepgram";
import { listenUrl, speakUrl } from "@/features/interview-prototype/deepgram-urls";
import { disabledResponse, prototypeEnabled } from "@/features/interview-prototype/gate";
import { voiceById } from "@/features/interview-prototype/languages";
import { arrangePlan } from "@/features/interview-prototype/plan";
import { logFailure, safeMessage } from "@/features/interview-prototype/route-utils";
import { StartRequestSchema, type Plan, type SessionResponse } from "@/features/interview-prototype/schemas";
import { planInterview } from "@/lib/ai";

/** Starts an interview: writes the question plan and mints the browser's short-lived Deepgram token. */
export async function POST(request: Request) {
  if (!prototypeEnabled()) return disabledResponse();

  const parsed = StartRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  const { jobDescription, resume, durationMinutes, voice } = parsed.data;
  // The voice decides the language of the interview, and the speed and expressivity it speaks with.
  const { name, language, model, speed, expressivity } = voiceById(voice);

  try {
    const [{ plan: draft, usage }, token] = await Promise.all([
      planInterview({ jobDescription, resume, language }),
      // The token only has to be valid when each socket opens, so it lives as long as the interview plus a margin.
      mintBrowserToken(durationMinutes * 60 + 600),
    ]);
    const arranged = arrangePlan(draft);
    if (!arranged) return Response.json({ error: "The interview plan came back incomplete. Try again." }, { status: 502 });

    const plan: Plan = { ...arranged, language, interviewerName: name };
    const body: SessionResponse = {
      plan,
      budgetMs: durationMinutes * 60_000,
      usage,
      deepgram: { token, listenUrl: listenUrl(language), speakUrl: speakUrl(model, { speed, expressivity }) },
    };
    return Response.json(body);
  } catch (error) {
    logFailure("session", error);
    return Response.json({ error: safeMessage(error, "Could not start the interview. Try again.") }, { status: 502 });
  }
}
