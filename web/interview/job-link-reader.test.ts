import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { JobLinkReader, TYPING_PAUSE_MS, type LinkState } from "./job-link-reader";
import type { ReadJobResult } from "./schemas";

const usage = { input: 400, output: 120, cacheRead: 0, cacheWrite: 0 };
const lever = "https://jobs.lever.co/Flex/151e09c6-398f-4fe0-8da7-8fd7814d1bae";
const gupy = "https://verity.gupy.io/jobs/12732278";

const ok = (roleTitle: string, companyName: string | null = "Flex"): ReadJobResult => ({ ok: true, jobDescription: `Role: ${roleTitle}`, roleTitle, companyName, usage });

/** A read the test finishes by hand, so it can look at the field while the read is running. */
function harness() {
  const states: LinkState[] = [];
  const pending: { url: string; resolve: (result: ReadJobResult) => void; reject: (error: unknown) => void }[] = [];
  const read = vi.fn(
    (url: string) =>
      new Promise<ReadJobResult>((resolve, reject) => {
        pending.push({ url, resolve, reject });
      }),
  );
  const reader = new JobLinkReader((state) => states.push(state), { read, setTimer: (callback, ms) => setTimeout(callback, ms), clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>) });
  const settle = (index: number, result: ReadJobResult) => {
    pending[index].resolve(result);
    return vi.advanceTimersByTimeAsync(0);
  };
  return { reader, read, pending, states, settle, state: () => reader.getState() };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("pasting a link", () => {
  it("starts reading at once, then shows the role and company that were understood", async () => {
    const h = harness();
    h.reader.pasted(lever);
    expect(h.state()).toEqual({ status: "reading", url: lever });
    expect(h.read).toHaveBeenCalledWith(lever);

    await h.settle(0, ok("Senior Software Engineer, Backend"));
    expect(h.state()).toMatchObject({ status: "ok", read: { url: lever, roleTitle: "Senior Software Engineer, Backend", companyName: "Flex", usage } });
  });

  it("completes a link written without https:// and reads that", () => {
    const h = harness();
    h.reader.pasted("www.linkedin.com/jobs/view/4480371955");
    expect(h.read).toHaveBeenCalledWith("https://www.linkedin.com/jobs/view/4480371955");
  });

  it("reads the link in a share text", () => {
    const h = harness();
    h.reader.pasted("Check out this job at Certara: https://www.linkedin.com/jobs/view/4480371955");
    expect(h.read).toHaveBeenCalledWith("https://www.linkedin.com/jobs/view/4480371955");
  });

  it("shows why an address cannot be read and reads nothing", () => {
    const h = harness();
    for (const text of ["http://localhost:3000/vaga", "https://192.168.0.10/vaga", "isto não é um link"]) {
      h.reader.pasted(text);
      expect(h.state()).toMatchObject({ status: "invalid", message: "Enter the public web address of the posting." });
    }
    expect(h.read).not.toHaveBeenCalled();
  });

  it("shows the message of a read that failed, and tries the same link again when it is pasted again", async () => {
    const h = harness();
    h.reader.pasted(lever);
    await h.settle(0, { ok: false, error: "No job posting was found at that address. Paste the text of the posting instead." });
    expect(h.state()).toEqual({ status: "error", url: lever, message: "No job posting was found at that address. Paste the text of the posting instead." });

    h.reader.blurred(lever); // leaving the field does not spend money again
    expect(h.read).toHaveBeenCalledTimes(1);

    h.reader.pasted(lever);
    expect(h.state()).toEqual({ status: "reading", url: lever });
    expect(h.read).toHaveBeenCalledTimes(2);
  });

  it("shows a message when the call itself breaks", async () => {
    const h = harness();
    h.reader.pasted(lever);
    h.pending[0].reject(new Error("Failed to find Server Action"));
    await vi.advanceTimersByTimeAsync(0);
    expect(h.state()).toMatchObject({ status: "error", url: lever, message: "Could not read that page. Paste the text of the posting instead." });
  });

  it("is empty again when the field is cleared", () => {
    const h = harness();
    h.reader.pasted(lever);
    h.reader.typed("");
    expect(h.state()).toEqual({ status: "empty" });
  });
});

describe("typing a link", () => {
  it("reads nothing while keys are still coming, and reads once the person pauses", () => {
    const h = harness();
    for (const text of ["h", "https://jobs.lever.co/", "https://jobs.lever.co/Flex/151e09c6"]) {
      h.reader.typed(text);
      vi.advanceTimersByTime(TYPING_PAUSE_MS - 100);
    }
    expect(h.read).not.toHaveBeenCalled();
    expect(h.state()).toEqual({ status: "idle" });

    vi.advanceTimersByTime(100);
    expect(h.read).toHaveBeenCalledTimes(1);
    expect(h.read).toHaveBeenCalledWith("https://jobs.lever.co/Flex/151e09c6");
  });

  it("says an address cannot be read only after the pause, not on every key", () => {
    const h = harness();
    h.reader.typed("htt");
    expect(h.state()).toEqual({ status: "idle" });
    vi.advanceTimersByTime(TYPING_PAUSE_MS);
    expect(h.state()).toMatchObject({ status: "invalid" });
    expect(h.read).not.toHaveBeenCalled();
  });

  it("takes the check away at once when the link changes", async () => {
    const h = harness();
    h.reader.pasted(lever);
    await h.settle(0, ok("Backend"));
    expect(h.state().status).toBe("ok");

    h.reader.typed(`${lever}7`);
    expect(h.state()).toEqual({ status: "idle" });
  });

  it("keeps the check when only spaces were added", async () => {
    const h = harness();
    h.reader.pasted(lever);
    await h.settle(0, ok("Backend"));
    h.reader.typed(`${lever}  `);
    expect(h.state().status).toBe("ok");
    vi.advanceTimersByTime(TYPING_PAUSE_MS * 2);
    expect(h.read).toHaveBeenCalledTimes(1);
  });

  it("reads when the person leaves the field without waiting for the pause", () => {
    const h = harness();
    h.reader.typed(lever);
    h.reader.blurred(lever);
    expect(h.read).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(TYPING_PAUSE_MS * 2);
    expect(h.read).toHaveBeenCalledTimes(1);
  });
});

describe("a link that was read", () => {
  it("is never read twice in a visit", async () => {
    const h = harness();
    h.reader.pasted(lever);
    await h.settle(0, ok("Backend"));

    h.reader.pasted(gupy);
    await h.settle(1, ok("Java Backend Sênior", "Verity"));
    expect(h.state()).toMatchObject({ status: "ok", read: { url: gupy } });

    h.reader.pasted(lever);
    expect(h.state()).toMatchObject({ status: "ok", read: { url: lever, roleTitle: "Backend" } });
    expect(h.read).toHaveBeenCalledTimes(2);
  });
});

describe("changing the link while a read is running", () => {
  it("never shows the old link's result for the new link, and reads only the link the field holds now", async () => {
    const h = harness();
    h.reader.pasted(lever);
    h.reader.pasted(gupy);
    expect(h.state()).toEqual({ status: "reading", url: gupy });
    expect(h.read).toHaveBeenCalledTimes(1); // one read at a time

    await h.settle(0, ok("Backend")); // the old one finishes: the field does not show it
    expect(h.state()).toEqual({ status: "reading", url: gupy });
    expect(h.read).toHaveBeenCalledTimes(2);
    expect(h.read).toHaveBeenLastCalledWith(gupy);

    await h.settle(1, ok("Java Backend Sênior", "Verity"));
    expect(h.state()).toMatchObject({ status: "ok", read: { url: gupy, roleTitle: "Java Backend Sênior" } });
  });

  it("does not read the links that were replaced before the running read ended", async () => {
    const h = harness();
    h.reader.pasted(lever);
    h.reader.pasted("https://jobs.example.com/a");
    h.reader.pasted("https://jobs.example.com/b");
    h.reader.pasted(gupy);
    await h.settle(0, ok("Backend"));
    expect(h.read.mock.calls.map(([url]) => url)).toEqual([lever, gupy]);
  });

  it("shows nothing for a read that ends after the person typed something else", async () => {
    const h = harness();
    h.reader.pasted(lever);
    h.reader.typed("https://jobs.");
    await h.settle(0, ok("Backend"));
    expect(h.state()).toEqual({ status: "idle" });
  });

  it("shows the result at once when the person goes back to the link that was running", async () => {
    const h = harness();
    h.reader.pasted(lever);
    h.reader.typed("https://jobs.");
    h.reader.pasted(lever);
    expect(h.state()).toEqual({ status: "reading", url: lever });
    expect(h.read).toHaveBeenCalledTimes(1);
    await h.settle(0, ok("Backend"));
    expect(h.state()).toMatchObject({ status: "ok", read: { url: lever } });
  });
});

describe("leaving the page", () => {
  it("stops the pause and ignores a read that ends later", async () => {
    const h = harness();
    h.reader.typed(lever);
    h.reader.dispose();
    vi.advanceTimersByTime(TYPING_PAUSE_MS * 2);
    expect(h.read).not.toHaveBeenCalled();

    const h2 = harness();
    h2.reader.pasted(lever);
    const before = h2.states.length;
    h2.reader.dispose();
    await h2.settle(0, ok("Backend"));
    expect(h2.states).toHaveLength(before);
  });
});
