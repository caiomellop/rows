import { PcmPlayer, startMic } from "./audio";
import { InterviewController, initialView, type StartForm, type View } from "./controller";
import { JobLinkReader, type LinkState } from "./job-link-reader";
import { jobUrlFrom, parseJobUrlInput } from "./job-url";
import { DEFAULT_VOICE, VOICE_IDS, type VoiceId } from "./languages";
import { estimateCost, resultsMarkdown, summarizeLatency, type TurnLatency } from "./metrics";
import { CRITERIA, DURATIONS, type ReadJobResult } from "./schemas";
import { connectStt, connectTts } from "./sockets";
import { formatClock } from "./state";

/**
 * CAI-36: the whole prototype page. Paste the link to a job posting (or its text), press Começar and talk.
 * Nothing is saved: closing the page forgets the interview.
 *
 * The server renders the setup form (prepermint/templates/interview/page.html). This module wires it up, and draws
 * the live interview and the results into #interview-stage as the controller reports each change.
 */

const CRITERION_LABELS: Record<(typeof CRITERIA)[number], string> = {
  relevance: "Relevance",
  structure: "Structure",
  specificity: "Specificity",
  communication: "Communication",
  roleFit: "Role fit",
};

const STATUS_LABELS = { listening: "Listening", thinking: "Thinking", speaking: "Speaking" } as const;

const card = "rounded-2xl border border-line bg-card p-5";
const quietButton = "h-10 rounded-full border border-line bg-card px-5 text-[14px] text-fg transition-colors hover:bg-panel";
const alertBox = "rounded-xl border border-line bg-panel px-4 py-3 text-[14px] text-fg";

const ICON_CHECK = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-5 text-emerald-600"><path d="M20 6 9 17l-5-5"/></svg>';
const ICON_ALERT = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-5 text-fg"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>';
const ICON_SPINNER = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-5 animate-spin text-fg-3"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>';

/** Text placed into HTML. Every value that comes from the person, the model or the network goes through this. */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const usd = (value: number) => `$${value.toFixed(value < 0.1 ? 3 : 2)}`;

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`#${id} is missing from the page.`);
  return element as T;
}

/* ------------------------------------------------------------------ */
/* Server calls that were Server Actions                               */
/* ------------------------------------------------------------------ */

async function readJobPosting(url: string): Promise<ReadJobResult> {
  const response = await fetch("/interview/read-job", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
  if (!response.ok) throw new Error(`read-job answered ${response.status}`);
  return (await response.json()) as ReadJobResult;
}

function warmUpJobReader(): void {
  void fetch("/interview/warm-up", { method: "POST" }).catch(() => {});
}

/* ------------------------------------------------------------------ */
/* Setup                                                               */
/* ------------------------------------------------------------------ */

type Mode = "link" | "text";

class Setup {
  private mode: Mode = "link";
  private link: LinkState = { status: "empty" };
  private readonly reader: JobLinkReader;
  private readonly form = byId<HTMLFormElement>("interview-setup");
  private readonly urlInput = byId<HTMLInputElement>("job-posting-url");
  private readonly textInput = byId<HTMLTextAreaElement>("job-description");
  private readonly startButton = byId<HTMLButtonElement>("interview-start");

  constructor(private readonly onStart: (form: StartForm) => void) {
    // The field reads the posting as soon as it holds a link (see JobLinkReader), so the button waits for that read.
    this.reader = new JobLinkReader((state) => this.showLink(state), {
      read: (url) => readJobPosting(url),
      setTimer: (callback, ms) => setTimeout(callback, ms),
      clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    });

    this.urlInput.addEventListener("input", () => {
      this.reader.typed(this.urlInput.value);
      this.update();
    });
    this.urlInput.addEventListener("paste", (event) => {
      event.preventDefault();
      // The field holds one address: the pasted text is cut down to the address in it, or kept on one line.
      const text = event.clipboardData?.getData("text") ?? "";
      const parsed = parseJobUrlInput(text);
      this.urlInput.value = parsed.state === "valid" ? parsed.url : text.replace(/\s+/g, " ").trim().slice(0, 2_000);
      this.reader.pasted(this.urlInput.value);
    });
    this.urlInput.addEventListener("blur", () => {
      // Show the address in full once the person is done: "www.…" becomes "https://www.…".
      const parsed = parseJobUrlInput(this.urlInput.value);
      if (parsed.state === "valid" && parsed.url !== this.urlInput.value) this.urlInput.value = parsed.url;
      this.reader.blurred(this.urlInput.value);
    });
    this.textInput.addEventListener("input", () => this.update());

    this.form.addEventListener("click", (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-switch-mode]");
      if (target) this.switchTo(target.dataset.switchMode === "text" ? "text" : "link");
    });
    this.form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.start();
    });

    // Wake the Apify server now, while the person is still looking for the link. Nothing waits for it.
    warmUpJobReader();
    this.update();
  }

  dispose(): void {
    this.reader.dispose();
  }

  setStarting(starting: boolean, error: string | null): void {
    byId("interview-starting").hidden = !starting;
    const box = byId("interview-setup-error");
    box.hidden = !error;
    box.textContent = error ?? "";
    this.startButton.disabled = starting || !this.ready();
    this.startButton.dataset.starting = starting ? "true" : "";
  }

  private switchTo(next: Mode): void {
    this.mode = next;
    byId("job-link-mode").hidden = next !== "link";
    byId("job-text-mode").hidden = next !== "text";
    // After the person switches mode the cursor goes to the field that appeared.
    (next === "link" ? this.urlInput : this.textInput).focus();
    this.update();
  }

  private ready(): boolean {
    if (this.mode === "link") return this.link.status === "ok";
    const text = this.textInput.value;
    return text.trim().length >= 40 && jobUrlFrom(text) === null;
  }

  private update(): void {
    byId("job-text-is-link").hidden = jobUrlFrom(this.textInput.value) === null;
    if (!this.startButton.dataset.starting) this.startButton.disabled = !this.ready();
  }

  /** The link field reads the page itself and shows how that went. */
  private showLink(state: LinkState): void {
    this.link = state;
    const failed = state.status === "invalid" || state.status === "error";
    this.urlInput.setAttribute("aria-invalid", String(failed));
    byId("job-posting-url-icon").innerHTML = state.status === "reading" ? ICON_SPINNER : state.status === "ok" ? ICON_CHECK : failed ? ICON_ALERT : "";

    // Always in the page, so a screen reader announces each change: reading, read, or why not.
    const status = byId("job-posting-url-status");
    if (state.status === "reading") status.textContent = "Reading the job posting…";
    else if (state.status === "ok")
      status.innerHTML = `<span class="sr-only">Read: </span>${escapeHtml(state.read.roleTitle)}${state.read.companyName ? ` · ${escapeHtml(state.read.companyName)}` : ""}`;
    else if (state.status === "error")
      status.innerHTML = `${escapeHtml(state.message)} <button type="button" data-switch-mode="text" class="text-[13px] text-fg-2 underline underline-offset-2 transition-colors hover:text-fg">Do it by text</button>`;
    else if (state.status === "invalid") status.textContent = state.message;
    else status.textContent = "";
    this.update();
  }

  private start(): void {
    if (!this.ready() || this.startButton.dataset.starting) return;
    const duration = Number(byId<HTMLSelectElement>("interview-duration").value);
    const voiceValue = byId<HTMLSelectElement>("interview-voice").value;
    const rest = {
      resume: byId<HTMLTextAreaElement>("interview-resume").value,
      durationMinutes: (DURATIONS as readonly number[]).includes(duration) ? (duration as StartForm["durationMinutes"]) : 15,
      voice: (VOICE_IDS as readonly string[]).includes(voiceValue) ? (voiceValue as VoiceId) : DEFAULT_VOICE,
    };
    if (this.mode === "link" && this.link.status === "ok") this.onStart({ ...rest, jobDescription: this.link.read.jobDescription, readUsage: this.link.read.usage });
    else this.onStart({ ...rest, jobDescription: this.textInput.value });
  }
}

/* ------------------------------------------------------------------ */
/* Live and results                                                    */
/* ------------------------------------------------------------------ */

function message(role: "interviewer" | "candidate", text: string, options: { muted?: boolean; interrupted?: boolean } = {}): string {
  return `<div${options.muted ? ' class="opacity-60"' : ""}>
    <p class="font-geist text-[11px] uppercase tracking-[0.14em] text-fg-3">${role === "interviewer" ? "Interviewer" : "You"}</p>
    <p class="mt-1 text-[16px] leading-relaxed text-fg">${escapeHtml(text)}${options.interrupted ? '<span class="ml-2 text-[13px] italic text-fg-3">(interrupted)</span>' : ""}</p>
  </div>`;
}

export function liveHtml(view: View): string {
  const last = view.latencies.at(-1);
  const role = view.role ? `<p class="mt-4 text-[14px] text-fg-2">Interview for ${escapeHtml(view.role.title)}${view.role.company ? ` at ${escapeHtml(view.role.company)}` : ""}</p>` : "";
  const error = view.error ? `<p role="alert" class="mt-4 ${alertBox}">${escapeHtml(view.error)}</p>` : "";
  const turns = view.turns.map((turn) => message(turn.role, turn.text, { interrupted: turn.interrupted })).join("");
  const speaking = view.speaking ? message("interviewer", view.speaking, { muted: true }) : "";
  const partial = view.partial ? message("candidate", view.partial, { muted: true }) : "";
  const latency = last ? `Last reply: first audio ${last.totalMs} ms after your last word.` : "Latency appears here after your first answer.";
  const startup = view.startupMs !== null ? ` Opening took ${view.startupMs} ms.` : "";
  return `<section class="mt-8">
    <div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-card px-5 py-3">
      <p role="status" class="flex items-center gap-2 text-[15px] text-fg">
        <span aria-hidden="true" class="size-2.5 rounded-full ${view.status === "listening" ? "bg-fg" : "animate-pulse bg-fg-3"}"></span>${STATUS_LABELS[view.status]}
      </p>
      <p class="font-mono text-[14px] tabular-nums text-fg-2" aria-label="Time left">${formatClock(Math.max(0, view.budgetMs - view.elapsedMs))} left</p>
      <button type="button" data-action="end" class="${quietButton}">End interview</button>
    </div>
    ${role}${error}
    <div class="mt-6 space-y-4" aria-live="polite">${turns}${speaking}${partial}</div>
    <p class="mt-6 text-[13px] text-fg-3">${latency}${startup}</p>
  </section>`;
}

function feedbackHtml(view: View): string {
  const { feedback } = view;
  if (feedback.state === "loading" || feedback.state === "idle") {
    return '<p role="status" class="mt-3 text-[14px] text-fg-3">Writing the feedback. This takes up to a minute.</p>';
  }
  if (feedback.state === "failed" || !feedback.report) {
    const retry = view.turns.some((turn) => turn.role === "candidate") ? `<button type="button" data-action="retry-feedback" class="${quietButton} mt-3">Try again</button>` : "";
    return `<div class="mt-3"><p class="text-[14px] text-fg-2">${escapeHtml(feedback.error ?? "Could not write the feedback.")}</p>${retry}</div>`;
  }
  const { report } = feedback;
  const list = (title: string, items: string[]) =>
    `<div><h3 class="font-geist text-[12px] uppercase tracking-[0.14em] text-fg-3">${title}</h3><ul class="mt-2 list-disc space-y-1 pl-5 text-[14px] leading-relaxed text-fg-2">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>`;
  const scores = report.scores
    .map(
      (score) =>
        `<li class="flex gap-3 text-[14px] leading-relaxed"><span class="w-44 shrink-0 text-fg">${CRITERION_LABELS[score.criterion]} <span class="font-mono tabular-nums text-fg-2">${score.score}/5</span></span><span class="text-fg-2">${escapeHtml(score.note)}</span></li>`,
    )
    .join("");
  return `<div class="mt-3 space-y-5"><p class="text-[15px] leading-relaxed text-fg">${escapeHtml(report.summary)}</p><ul class="space-y-2">${scores}</ul>${list("Strengths", report.strengths)}${list("To improve", report.improvements)}</div>`;
}

function latencyTable(latencies: TurnLatency[]): string {
  const rows = latencies
    .map(
      (row) =>
        `<tr class="border-t border-line-subtle"><td class="py-1.5 pr-3">${row.turn}</td><td class="py-1.5 pr-3">${row.detectMs}</td><td class="py-1.5 pr-3">${row.modelMs}</td><td class="py-1.5 pr-3">${row.sentenceMs}</td><td class="py-1.5 pr-3">${row.voiceMs}</td><td class="py-1.5 text-fg">${row.totalMs}</td></tr>`,
    )
    .join("");
  return `<div class="mt-5 overflow-x-auto"><table class="w-full min-w-[34rem] text-left text-[13px]">
    <caption class="sr-only">Delay for each reply, in milliseconds</caption>
    <thead class="text-fg-3"><tr><th class="py-1.5 pr-3 font-normal">Reply</th><th class="py-1.5 pr-3 font-normal">Turn detected</th><th class="py-1.5 pr-3 font-normal">Claude first text</th><th class="py-1.5 pr-3 font-normal">First sentence</th><th class="py-1.5 pr-3 font-normal">Voice</th><th class="py-1.5 font-normal">Total</th></tr></thead>
    <tbody class="font-mono tabular-nums text-fg-2">${rows}</tbody></table></div>`;
}

export function resultsText(view: View): string {
  return resultsMarkdown({
    language: view.language ?? "en",
    minutes: view.elapsedMs / 60_000,
    candidateTurns: view.turns.filter((turn) => turn.role === "candidate").length,
    latencies: view.latencies,
    usage: view.usage,
  });
}

export function resultsHtml(view: View, copied: boolean): string {
  const minutes = view.elapsedMs / 60_000;
  const summary = summarizeLatency(view.latencies);
  const cost = estimateCost(view.usage, minutes);
  const stat = (label: string, value: string) => `<div><dt class="text-[12px] text-fg-3">${label}</dt><dd class="mt-0.5 font-mono text-[15px] tabular-nums text-fg">${value}</dd></div>`;
  const latency = summary
    ? `<dl class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">${stat("Average", `${summary.avgMs} ms`)}${stat("Median", `${summary.p50Ms} ms`)}${stat("Slowest 10%", `${summary.p90Ms} ms`)}${stat("Under 1 s", `${summary.under1s} of ${summary.count}`)}${stat("Within 2 s", `${summary.under2s} of ${summary.count}`)}</dl>${latencyTable(view.latencies)}`
    : '<p class="mt-3 text-[14px] text-fg-3">Nothing was measured: the interviewer was never answered after you spoke.</p>';
  const costLine =
    cost.per30MinUsd === null ? `This run cost about ${usd(cost.totalUsd)}. It was too short to scale to 30 minutes.` : `About ${usd(cost.per30MinUsd)} for 30 minutes (this run: ${usd(cost.totalUsd)}).`;
  const error = view.error ? `<p role="alert" class="${alertBox}">${escapeHtml(view.error)}</p>` : "";
  return `<div class="mt-8 space-y-6">
    ${error}
    <section class="${card}" aria-labelledby="feedback-title"><h2 id="feedback-title" class="text-[1.5rem] text-fg">Feedback</h2>${feedbackHtml(view)}</section>
    <section class="${card}" aria-labelledby="latency-title"><h2 id="latency-title" class="text-[1.5rem] text-fg">Latency</h2>${latency}</section>
    <section class="${card}" aria-labelledby="cost-title"><h2 id="cost-title" class="text-[1.5rem] text-fg">Cost</h2>
      <p class="mt-3 text-[15px] text-fg">${costLine}</p>
      <p class="mt-2 text-[13px] leading-relaxed text-fg-3">Speech recognition ${usd(cost.sttUsd)} (${view.usage.sttSeconds.toFixed(0)} s of audio) · voice ${usd(cost.ttsUsd)} (${view.usage.ttsChars} characters) · Claude live turns ${usd(cost.llmUsd)} · feedback report ${usd(cost.feedbackUsd)}. Prices are estimates from the rate card in the code.</p>
    </section>
    <section class="${card}" aria-labelledby="results-title"><h2 id="results-title" class="text-[1.5rem] text-fg">Results for the issue</h2>
      <p class="mt-2 text-[13px] text-fg-3">Paste this into the Linear issue after each run, and fill in the two judgments.</p>
      <pre class="mt-3 overflow-x-auto whitespace-pre-wrap rounded-xl bg-panel p-4 text-[13px] leading-relaxed text-fg">${escapeHtml(resultsText(view))}</pre>
      <button type="button" data-action="copy" class="${quietButton} mt-3">${copied ? "Copied" : "Copy results"}</button>
    </section>
    <section class="${card}" aria-labelledby="transcript-title"><h2 id="transcript-title" class="text-[1.5rem] text-fg">Transcript</h2>
      <p class="mt-2 text-[13px] text-fg-3">Check that hesitations such as &ldquo;um&rdquo; and &ldquo;uh&rdquo; were kept.</p>
      <div class="mt-4 space-y-4">${view.turns.map((turn) => message(turn.role, turn.text, { interrupted: turn.interrupted })).join("")}</div>
    </section>
    <button type="button" data-action="new" class="btn-primary h-11 rounded-full px-7 text-[15px]">New interview</button>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* The page                                                            */
/* ------------------------------------------------------------------ */

function mount(): void {
  const setupSection = byId("interview-setup");
  const stage = byId("interview-stage");
  let controller: InterviewController | null = null;
  let view: View = initialView();
  let copied = false;

  const render = (next: View) => {
    if (next.phase !== view.phase) copied = false;
    view = next;
    const inSetup = view.phase === "setup" || view.phase === "starting";
    setupSection.hidden = !inSetup;
    if (inSetup) {
      stage.innerHTML = "";
      setup.setStarting(view.phase === "starting", view.error);
    } else {
      stage.innerHTML = view.phase === "live" ? liveHtml(view) : resultsHtml(view, copied);
    }
  };

  const setup = new Setup((form) => {
    controller?.dispose();
    controller = new InterviewController(render, {
      startMic,
      createPlayer: () => new PcmPlayer(),
      connectStt,
      connectTts,
      fetch: (input, init) => fetch(input, init),
      now: () => performance.now(),
    });
    void controller.start(form);
  });

  stage.addEventListener("click", (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>("[data-action]")?.dataset.action;
    if (action === "end") controller?.end();
    else if (action === "retry-feedback") void controller?.retryFeedback();
    else if (action === "copy") {
      navigator.clipboard.writeText(resultsText(view)).then(
        () => {
          copied = true;
          render(view);
        },
        () => {
          copied = false;
        },
      );
    } else if (action === "new") {
      // Starting over stops the microphone, the sockets and the sound.
      controller?.dispose();
      controller = null;
      render(initialView());
    }
  });

  // Closing the page stops the microphone, the sockets and the sound.
  window.addEventListener("pagehide", () => {
    controller?.dispose();
    setup.dispose();
  });
}

if (typeof document !== "undefined" && document.getElementById("interview-setup")) mount();
