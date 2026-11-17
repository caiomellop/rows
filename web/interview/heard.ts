/**
 * What the candidate actually heard when they interrupted. The voice sends audio for each piece of
 * text separately, so the audio length of every piece is known; the candidate heard every piece
 * that finished playing, plus the matching share of the one that was playing.
 */
export type Segment = { text: string; audioMs: number };

export function heardText(segments: Segment[], playedMs: number): string {
  const heard: string[] = [];
  let start = 0;
  for (const segment of segments) {
    // Audio arrives in order: a piece with no audio yet, and everything after it, was not heard.
    if (segment.audioMs <= 0) break;
    const end = start + segment.audioMs;
    if (playedMs >= end) {
      heard.push(segment.text);
      start = end;
      continue;
    }
    if (playedMs > start && segment.audioMs > 0) {
      const words = segment.text.split(/\s+/).filter(Boolean);
      const count = Math.floor((words.length * (playedMs - start)) / segment.audioMs);
      if (count > 0) heard.push(words.slice(0, count).join(" "));
    }
    break;
  }
  return heard.join(" ").trim();
}
