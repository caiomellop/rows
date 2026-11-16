import { MOVES, type Move } from "./schemas";

/**
 * Reads the move tag the model writes at the start of its reply (`[[NEXT]]`, `[[FOLLOW_UP]]`, `[[END]]`)
 * out of a stream, and passes everything after it on to be spoken. The tag is a few tokens, so the
 * voice starts as soon as the first words arrive.
 */
export class MoveTagParser {
  /** The move, once the tag has been read. Null if the reply had no valid tag. */
  move: Move | null = null;
  /** True once the start of the reply has been classified as tag or no tag. */
  settled = false;
  private buffer = "";

  /** Feeds a streamed piece. Returns the text that is ready to be spoken. */
  push(piece: string): string {
    if (this.settled) return piece;
    this.buffer += piece;
    const text = this.buffer.trimStart();

    if (text.length < 2) return "";
    if (!text.startsWith("[[")) return this.release();

    const close = text.indexOf("]]");
    if (close === -1) return text.length > 24 ? this.release() : "";

    const name = text.slice(2, close).trim().toUpperCase();
    this.move = (MOVES as readonly string[]).includes(name) ? (name as Move) : null;
    this.settled = true;
    this.buffer = "";
    return text.slice(close + 2).trimStart();
  }

  /** Call when the stream ends. Returns any text that was held back. */
  flush(): string {
    if (this.settled) return "";
    return this.release();
  }

  private release(): string {
    this.settled = true;
    const out = this.buffer.trimStart();
    this.buffer = "";
    return out;
  }
}
