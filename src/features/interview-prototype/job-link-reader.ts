import { parseJobUrlInput } from "./job-url";
import type { ReadJobResult } from "./schemas";

/**
 * The "Job posting URL" field, without the screen: it decides when a link is read, keeps what it read, and says
 * what the field should show. The form feeds it what the person types and pastes; the read itself is injected
 * (a Server Action in the page, a fake in the tests).
 *
 * Reading costs money and takes 10 to 25 seconds, so:
 * - nothing is read while the person is still typing, only after a pause or on paste;
 * - one read runs at a time, and when the field moves on only the link it holds now is read after it
 *   (Next.js sends Server Actions one at a time anyway);
 * - a link that was read is never read twice in a visit.
 */

/** The pause after the last key before a typed link is read. */
export const TYPING_PAUSE_MS = 1000;

export type JobRead = { url: string; jobDescription: string; roleTitle: string; companyName: string | null; usage: Extract<ReadJobResult, { ok: true }>["usage"] };

export type LinkState =
  | { status: "empty" }
  /** The text changed and nothing is decided yet. */
  | { status: "idle" }
  | { status: "invalid"; message: string }
  | { status: "reading"; url: string }
  | { status: "ok"; read: JobRead }
  | { status: "error"; url: string; message: string };

export type ReaderDeps = {
  read: (url: string) => Promise<ReadJobResult>;
  setTimer: (callback: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
};

const READ_FAILED = "Could not read that page. Paste the text of the posting instead.";

export class JobLinkReader {
  private state: LinkState = { status: "empty" };
  private readonly cache = new Map<string, JobRead>();
  private timer: unknown = null;
  /** The link a read is running for. */
  private inFlight: string | null = null;
  /** The link the field holds now and wants read, if it holds one. */
  private want: string | null = null;
  private disposed = false;

  constructor(
    private readonly listener: (state: LinkState) => void,
    private readonly deps: ReaderDeps,
  ) {}

  getState(): LinkState {
    return this.state;
  }

  /** A key was pressed. A complete link is read after a pause, an incomplete one is left alone. */
  typed(raw: string): void {
    const parsed = parseJobUrlInput(raw);
    if (parsed.state === "empty") return this.reset();
    this.clearPause();
    // Same link as before (a space at the end, say): the check stays.
    if (parsed.state === "valid" && parsed.url === this.stateUrl()) return;

    this.want = null;
    this.set({ status: "idle" });
    this.timer = this.deps.setTimer(() => {
      this.timer = null;
      this.evaluate(raw, false);
    }, TYPING_PAUSE_MS);
  }

  /** The text was pasted: decide now. Pasting the link that just failed tries it again. */
  pasted(raw: string): void {
    this.clearPause();
    this.evaluate(raw, true);
  }

  /** The person left the field. A link that is already decided is not touched. */
  blurred(raw: string): void {
    this.clearPause();
    this.evaluate(raw, false);
  }

  dispose(): void {
    this.disposed = true;
    this.clearPause();
  }

  private evaluate(raw: string, retry: boolean): void {
    const parsed = parseJobUrlInput(raw);
    if (parsed.state === "empty") return this.reset();
    if (parsed.state === "invalid") {
      this.want = null;
      return this.set({ status: "invalid", message: parsed.message });
    }

    const url = parsed.url;
    this.want = url;
    const cached = this.cache.get(url);
    if (cached) return this.set({ status: "ok", read: cached });

    const state = this.state;
    if (state.status === "reading" && state.url === url) return;
    if (state.status === "error" && state.url === url && !retry) return;

    this.set({ status: "reading", url });
    this.pump();
  }

  /** Starts the read for the link the field wants, unless one is running: that one calls this again when it ends. */
  private pump(): void {
    const url = this.want;
    if (this.inFlight || !url || this.cache.has(url)) return;
    this.inFlight = url;
    this.deps.read(url).then(
      (result) => this.finish(url, result),
      () => this.finish(url, { ok: false, error: READ_FAILED }),
    );
  }

  private finish(url: string, result: ReadJobResult): void {
    this.inFlight = null;
    // A read that worked is kept even if the field has moved on: the person may come back to that link.
    if (result.ok) this.cache.set(url, { url, jobDescription: result.jobDescription, roleTitle: result.roleTitle, companyName: result.companyName, usage: result.usage });
    if (this.disposed) return;

    if (this.want === url) {
      const read = this.cache.get(url);
      return this.set(read ? { status: "ok", read } : { status: "error", url, message: result.ok ? READ_FAILED : result.error });
    }

    // The field moved on while this read ran. If it now holds another link, that one is next.
    const next = this.want;
    const cached = next ? this.cache.get(next) : undefined;
    if (next && cached) this.set({ status: "ok", read: cached });
    else this.pump();
  }

  private reset(): void {
    this.clearPause();
    this.want = null;
    this.set({ status: "empty" });
  }

  private stateUrl(): string | null {
    const state = this.state;
    if (state.status === "reading" || state.status === "error") return state.url;
    return state.status === "ok" ? state.read.url : null;
  }

  private clearPause(): void {
    if (this.timer !== null) this.deps.clearTimer(this.timer);
    this.timer = null;
  }

  private set(state: LinkState): void {
    this.state = state;
    if (!this.disposed) this.listener(state);
  }
}
