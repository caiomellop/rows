import { disabledResponse, prototypeEnabled } from "@/features/interview-prototype/gate";
import { MoveTagParser } from "@/features/interview-prototype/moves";
import { buildTurnPrompt } from "@/features/interview-prototype/prompt";
import { logFailure, safeMessage } from "@/features/interview-prototype/route-utils";
import { TurnRequestSchema, type TurnEvent } from "@/features/interview-prototype/schemas";
import { streamInterviewerTurn } from "@/lib/ai";

/**
 * One interviewer turn, streamed as one JSON event per line: the move first, then the words to speak
 * as Claude writes them, then the usage. The browser starts the voice on the first words.
 */
export async function POST(request: Request) {
  if (!prototypeEnabled()) return disabledResponse();

  const parsed = TurnRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const { system, messages } = buildTurnPrompt(parsed.data);

  const encoder = new TextEncoder();
  let closed = false;

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: TurnEvent) => {
        if (!closed) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      const parser = new MoveTagParser();
      let moveSent = false;
      const sendMove = () => {
        if (moveSent || !parser.settled) return;
        moveSent = true;
        send({ t: "move", move: parser.move });
      };

      try {
        for await (const event of streamInterviewerTurn({ system, messages, signal: request.signal })) {
          if (event.type === "text") {
            const speakable = parser.push(event.text);
            sendMove();
            if (speakable) send({ t: "text", text: speakable });
          } else {
            const rest = parser.flush();
            sendMove();
            if (rest) send({ t: "text", text: rest });
            send({ t: "done", usage: event.usage });
          }
        }
      } catch (error) {
        // A barge-in aborts the request on purpose, so only log what was not asked for.
        if (!request.signal.aborted) logFailure("turn", error);
        send({ t: "error", message: safeMessage(error, "The interviewer could not answer. Try again.") });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          // The browser already closed the stream.
        }
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(body, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
