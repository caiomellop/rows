/**
 * Cuts the model's streamed text into pieces for the voice. The first piece may end at a comma so
 * the voice starts sooner; every later piece ends at a sentence. Tiny pieces are held back and
 * joined to the next one, because very short snippets sound choppy.
 */

const MIN_PIECE = 12;
const MIN_FIRST_CLAUSE = 28;
const SENTENCE_END = new Set([".", "!", "?", "…"]);
const CLAUSE_END = new Set([",", ";", ":", "—", "–"]);
// Scripts that do not put a space after punctuation (Japanese and Chinese, the Hindi danda): cut right after it,
// or the voice would wait for the whole reply before it could start.
const SPACELESS_SENTENCE_END = new Set(["。", "！", "？", "।", "॥"]);
const SPACELESS_CLAUSE_END = new Set(["、", "，", "；", "："]);

export class SentenceChunker {
  private buffer = "";
  private emitted = 0;

  push(text: string): string[] {
    this.buffer += text;
    return this.drain(false);
  }

  /** Call when the stream ends: returns whatever is left. */
  flush(): string[] {
    return this.drain(true);
  }

  private drain(final: boolean): string[] {
    const pieces: string[] = [];
    for (let cut = this.findCut(); cut !== -1; cut = this.findCut()) {
      const piece = this.buffer.slice(0, cut).trim();
      this.buffer = this.buffer.slice(cut);
      if (piece) {
        pieces.push(piece);
        this.emitted += 1;
      }
    }
    if (final) {
      const rest = this.buffer.trim();
      this.buffer = "";
      if (rest) pieces.push(rest);
    }
    return pieces;
  }

  /** Index just after the next place to cut, or -1 if the buffer has no safe cut yet. */
  private findCut(): number {
    const text = this.buffer;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const length = i + 1;
      if (char === "\n" && length >= MIN_PIECE) return length;
      if (SPACELESS_SENTENCE_END.has(char) && length >= MIN_PIECE) return length;
      if (this.emitted === 0 && SPACELESS_CLAUSE_END.has(char) && length >= MIN_FIRST_CLAUSE) return length;
      // Everywhere else a boundary needs the space after it, so "3.5" and "e.g." are not cut.
      if (i + 1 >= text.length || !/\s/.test(text[i + 1])) continue;
      if (SENTENCE_END.has(char) && length >= MIN_PIECE && !this.isAbbreviation(text, i)) return length;
      if (this.emitted === 0 && CLAUSE_END.has(char) && length >= MIN_FIRST_CLAUSE) return length;
    }
    return -1;
  }

  /** "Mr." "e.g." "3." — a period after one or two characters is not the end of a sentence. */
  private isAbbreviation(text: string, dotIndex: number): boolean {
    if (text[dotIndex] !== ".") return false;
    const before = text.slice(0, dotIndex);
    const word = before.slice(before.search(/\S+$/));
    return word.length <= 2;
  }
}
