"use client";

import { useEffect, useState, type ReactNode } from "react";

import { PcmPlayer, startMic } from "./audio";
import { InterviewController, initialView, type StartForm, type View } from "./controller";
import { estimateCost, resultsMarkdown, summarizeLatency, type TurnLatency } from "./metrics";
import { LANGUAGE_NAMES, LANGUAGES } from "./languages";
import { CRITERIA, DURATIONS, LIMITS } from "./schemas";
import { connectStt, connectTts } from "./sockets";
import { formatClock } from "./state";
import { DEFAULT_VOICE, VOICES } from "./voices";

/**
 * CAI-36: the whole prototype page. Paste a job description, press Começar and talk.
 * Nothing is saved: closing the page forgets the interview.
 */

const CRITERION_LABELS: Record<(typeof CRITERIA)[number], string> = {
  relevance: "Relevance",
  structure: "Structure",
  specificity: "Specificity",
  communication: "Communication",
  roleFit: "Role fit",
};

/** "English, Portuguese, Spanish ... or Japanese", from the language table. */
const LANGUAGE_LIST = (() => {
  const names = LANGUAGES.map((code) => LANGUAGE_NAMES[code].replace("Brazilian ", ""));
  return `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
})();

const field = "w-full rounded-xl border border-line bg-card px-4 py-3 text-[15px] leading-relaxed text-fg placeholder:text-fg-3 focus:border-fg-3 focus:outline-none";
const card = "rounded-2xl border border-line bg-card p-5";
const quietButton = "h-10 rounded-full border border-line bg-card px-5 text-[14px] text-fg transition-colors hover:bg-panel";

export function InterviewPrototype() {
  const [view, setView] = useState<View>(initialView);
  const [controller, setController] = useState<InterviewController | null>(null);

  // Closing the page, or starting over, stops the microphone, the sockets and the sound.
  useEffect(() => () => controller?.dispose(), [controller]);

  function begin(form: StartForm) {
    const next = new InterviewController(setView, {
      startMic,
      createPlayer: () => new PcmPlayer(),
      connectStt,
      connectTts,
      fetch: (input, init) => fetch(input, init),
      now: () => performance.now(),
    });
    setController(next);
    void next.start(form);
  }

  function startOver() {
    setController(null);
    setView(initialView());
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10 sm:py-14">
      <p className="font-geist text-[12px] uppercase tracking-[0.14em] text-fg-3">Prototype · nothing is saved</p>
      <h1 className="mt-2 text-[2.2rem] leading-[1.1] text-fg">Mock interview by voice</h1>

      {(view.phase === "setup" || view.phase === "starting") && <Setup view={view} onStart={begin} />}
      {view.phase === "live" && <Live view={view} onEnd={() => controller?.end()} />}
      {view.phase === "done" && <Results view={view} onRetryFeedback={() => controller?.retryFeedback()} onNew={startOver} />}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Setup                                                               */
/* ------------------------------------------------------------------ */

function Setup({ view, onStart }: { view: View; onStart: (form: StartForm) => void }) {
  const [jobDescription, setJobDescription] = useState("");
  const [resume, setResume] = useState("");
  const [durationMinutes, setDurationMinutes] = useState<StartForm["durationMinutes"]>(15);
  const [voice, setVoice] = useState<StartForm["voice"]>(DEFAULT_VOICE);
  const starting = view.phase === "starting";
  const ready = jobDescription.trim().length >= 40;

  return (
    <form
      className="mt-8 space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready && !starting) onStart({ jobDescription, resume, durationMinutes, voice });
      }}
    >
      <Field label="Job description" hint={`Paste the posting. The interview is held in the language it is written in (${LANGUAGE_LIST}).`}>
        <textarea className={field} rows={9} required maxLength={LIMITS.jobDescription} value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
      </Field>
      <Field label="Resume summary (optional)" hint="A few lines about your background. The interviewer only uses what you write here.">
        <textarea className={field} rows={4} maxLength={LIMITS.resume} value={resume} onChange={(e) => setResume(e.target.value)} />
      </Field>
      <Field label="Length">
        <select className={`${field} max-w-[12rem]`} value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value) as StartForm["durationMinutes"])}>
          {DURATIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes} minutes
            </option>
          ))}
        </select>
      </Field>

      <fieldset>
        <legend className="text-[14px] font-medium text-fg">Voice</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {VOICES.map((option) => (
            <label
              key={option.id}
              className="flex cursor-pointer items-center gap-2 rounded-full border border-line bg-card px-5 py-2.5 text-[14px] text-fg-2 transition-colors has-[:checked]:border-fg has-[:checked]:text-fg has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2"
            >
              <input type="radio" name="voice" value={option.id} checked={voice === option.id} onChange={() => setVoice(option.id)} className="size-3.5 accent-accent" />
              {option.label}
            </label>
          ))}
        </div>
        <p className="mt-2 text-[13px] text-fg-3">Both voices speak at 0.9x. Cliff and Sienna only exist in English, so in any other language you hear a native voice of the same kind.</p>
      </fieldset>

      <p className="text-[13px] leading-relaxed text-fg-3">
        Use headphones. The microphone stays open while the interviewer speaks so you can interrupt, and speakers make it hear itself.
      </p>
      {view.error && (
        <p role="alert" className="rounded-xl border border-line bg-panel px-4 py-3 text-[14px] text-fg">
          {view.error}
        </p>
      )}
      <div className="flex items-center gap-4">
        <button type="submit" disabled={!ready || starting} className="btn-primary h-11 rounded-full px-7 text-[15px] disabled:cursor-not-allowed disabled:opacity-50">
          Começar
        </button>
        {starting && (
          <span role="status" className="text-[14px] text-fg-3">
            Preparing the interview…
          </span>
        )}
      </div>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[14px] font-medium text-fg">{label}</span>
      {hint && <span className="mt-0.5 block text-[13px] text-fg-3">{hint}</span>}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Live                                                                */
/* ------------------------------------------------------------------ */

const STATUS_LABELS = { listening: "Listening", thinking: "Thinking", speaking: "Speaking" } as const;

function Live({ view, onEnd }: { view: View; onEnd: () => void }) {
  const last = view.latencies.at(-1);
  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-card px-5 py-3">
        <p role="status" className="flex items-center gap-2 text-[15px] text-fg">
          <span aria-hidden className={`size-2.5 rounded-full ${view.status === "listening" ? "bg-fg" : "animate-pulse bg-fg-3"}`} />
          {STATUS_LABELS[view.status]}
        </p>
        <p className="font-mono text-[14px] tabular-nums text-fg-2" aria-label="Time left">
          {formatClock(Math.max(0, view.budgetMs - view.elapsedMs))} left
        </p>
        <button type="button" onClick={onEnd} className={quietButton}>
          End interview
        </button>
      </div>

      {view.error && (
        <p role="alert" className="mt-4 rounded-xl border border-line bg-panel px-4 py-3 text-[14px] text-fg">
          {view.error}
        </p>
      )}

      <div className="mt-6 space-y-4" aria-live="polite">
        {view.turns.map((turn, index) => (
          <Message key={index} role={turn.role} text={turn.text} interrupted={turn.interrupted} />
        ))}
        {view.speaking && <Message role="interviewer" text={view.speaking} muted />}
        {view.partial && <Message role="candidate" text={view.partial} muted />}
      </div>

      <p className="mt-6 text-[13px] text-fg-3">
        {last ? `Last reply: first audio ${last.totalMs} ms after your last word.` : "Latency appears here after your first answer."}
        {view.startupMs !== null && ` Opening took ${view.startupMs} ms.`}
      </p>
    </section>
  );
}

function Message({ role, text, muted, interrupted }: { role: "interviewer" | "candidate"; text: string; muted?: boolean; interrupted?: boolean }) {
  return (
    <div className={muted ? "opacity-60" : undefined}>
      <p className="font-geist text-[11px] uppercase tracking-[0.14em] text-fg-3">{role === "interviewer" ? "Interviewer" : "You"}</p>
      <p className="mt-1 text-[16px] leading-relaxed text-fg">
        {text}
        {interrupted && <span className="ml-2 text-[13px] italic text-fg-3">(interrupted)</span>}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Results                                                             */
/* ------------------------------------------------------------------ */

const usd = (value: number) => `$${value.toFixed(value < 0.1 ? 3 : 2)}`;

function Results({ view, onRetryFeedback, onNew }: { view: View; onRetryFeedback: () => void; onNew: () => void }) {
  const minutes = view.elapsedMs / 60_000;
  const summary = summarizeLatency(view.latencies);
  const cost = estimateCost(view.usage, minutes);
  const [copied, setCopied] = useState(false);
  const results = resultsMarkdown({
    language: view.language ?? "en",
    minutes,
    candidateTurns: view.turns.filter((turn) => turn.role === "candidate").length,
    latencies: view.latencies,
    usage: view.usage,
  });

  async function copy() {
    try {
      await navigator.clipboard.writeText(results);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      {view.error && (
        <p role="alert" className="rounded-xl border border-line bg-panel px-4 py-3 text-[14px] text-fg">
          {view.error}
        </p>
      )}

      <section className={card} aria-labelledby="feedback-title">
        <h2 id="feedback-title" className="text-[1.5rem] text-fg">
          Feedback
        </h2>
        <Feedback view={view} onRetry={onRetryFeedback} />
      </section>

      <section className={card} aria-labelledby="latency-title">
        <h2 id="latency-title" className="text-[1.5rem] text-fg">
          Latency
        </h2>
        {summary ? (
          <>
            <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
              <Stat label="Average" value={`${summary.avgMs} ms`} />
              <Stat label="Median" value={`${summary.p50Ms} ms`} />
              <Stat label="Slowest 10%" value={`${summary.p90Ms} ms`} />
              <Stat label="Under 1 s" value={`${summary.under1s} of ${summary.count}`} />
              <Stat label="Within 2 s" value={`${summary.under2s} of ${summary.count}`} />
            </dl>
            <LatencyTable latencies={view.latencies} />
          </>
        ) : (
          <p className="mt-3 text-[14px] text-fg-3">Nothing was measured: the interviewer was never answered after you spoke.</p>
        )}
      </section>

      <section className={card} aria-labelledby="cost-title">
        <h2 id="cost-title" className="text-[1.5rem] text-fg">
          Cost
        </h2>
        <p className="mt-3 text-[15px] text-fg">
          {cost.per30MinUsd === null ? `This run cost about ${usd(cost.totalUsd)}. It was too short to scale to 30 minutes.` : `About ${usd(cost.per30MinUsd)} for 30 minutes (this run: ${usd(cost.totalUsd)}).`}
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-fg-3">
          Speech recognition {usd(cost.sttUsd)} ({view.usage.sttSeconds.toFixed(0)} s of audio) · voice {usd(cost.ttsUsd)} ({view.usage.ttsChars} characters) · Claude live turns {usd(cost.llmUsd)} · feedback report{" "}
          {usd(cost.feedbackUsd)}. Prices are estimates from the rate card in the code.
        </p>
      </section>

      <section className={card} aria-labelledby="results-title">
        <h2 id="results-title" className="text-[1.5rem] text-fg">
          Results for the issue
        </h2>
        <p className="mt-2 text-[13px] text-fg-3">Paste this into the Linear issue after each run, and fill in the two judgments.</p>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-xl bg-panel p-4 text-[13px] leading-relaxed text-fg">{results}</pre>
        <button type="button" onClick={copy} className={`${quietButton} mt-3`}>
          {copied ? "Copied" : "Copy results"}
        </button>
      </section>

      <section className={card} aria-labelledby="transcript-title">
        <h2 id="transcript-title" className="text-[1.5rem] text-fg">
          Transcript
        </h2>
        <p className="mt-2 text-[13px] text-fg-3">Check that hesitations such as &ldquo;um&rdquo;, &ldquo;uh&rdquo;, &ldquo;é...&rdquo; and &ldquo;tipo&rdquo; were kept.</p>
        <div className="mt-4 space-y-4">
          {view.turns.map((turn, index) => (
            <Message key={index} role={turn.role} text={turn.text} interrupted={turn.interrupted} />
          ))}
        </div>
      </section>

      <button type="button" onClick={onNew} className="btn-primary h-11 rounded-full px-7 text-[15px]">
        New interview
      </button>
    </div>
  );
}

function Feedback({ view, onRetry }: { view: View; onRetry: () => void }) {
  const { feedback } = view;
  if (feedback.state === "loading" || feedback.state === "idle") {
    return (
      <p role="status" className="mt-3 text-[14px] text-fg-3">
        Writing the feedback. This takes up to a minute.
      </p>
    );
  }
  if (feedback.state === "failed" || !feedback.report) {
    return (
      <div className="mt-3">
        <p className="text-[14px] text-fg-2">{feedback.error ?? "Could not write the feedback."}</p>
        {view.turns.some((turn) => turn.role === "candidate") && (
          <button type="button" onClick={onRetry} className={`${quietButton} mt-3`}>
            Try again
          </button>
        )}
      </div>
    );
  }

  const { report } = feedback;
  return (
    <div className="mt-3 space-y-5">
      <p className="text-[15px] leading-relaxed text-fg">{report.summary}</p>
      <ul className="space-y-2">
        {report.scores.map((score) => (
          <li key={score.criterion} className="flex gap-3 text-[14px] leading-relaxed">
            <span className="w-44 shrink-0 text-fg">
              {CRITERION_LABELS[score.criterion]} <span className="font-mono tabular-nums text-fg-2">{score.score}/5</span>
            </span>
            <span className="text-fg-2">{score.note}</span>
          </li>
        ))}
      </ul>
      <List title="Strengths" items={report.strengths} />
      <List title="To improve" items={report.improvements} />
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="font-geist text-[12px] uppercase tracking-[0.14em] text-fg-3">{title}</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px] leading-relaxed text-fg-2">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] text-fg-3">{label}</dt>
      <dd className="mt-0.5 font-mono text-[15px] tabular-nums text-fg">{value}</dd>
    </div>
  );
}

function LatencyTable({ latencies }: { latencies: TurnLatency[] }) {
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[34rem] text-left text-[13px]">
        <caption className="sr-only">Delay for each reply, in milliseconds</caption>
        <thead className="text-fg-3">
          <tr>
            <th className="py-1.5 pr-3 font-normal">Reply</th>
            <th className="py-1.5 pr-3 font-normal">Turn detected</th>
            <th className="py-1.5 pr-3 font-normal">Claude first text</th>
            <th className="py-1.5 pr-3 font-normal">First sentence</th>
            <th className="py-1.5 pr-3 font-normal">Voice</th>
            <th className="py-1.5 font-normal">Total</th>
          </tr>
        </thead>
        <tbody className="font-mono tabular-nums text-fg-2">
          {latencies.map((row) => (
            <tr key={row.turn} className="border-t border-line-subtle">
              <td className="py-1.5 pr-3">{row.turn}</td>
              <td className="py-1.5 pr-3">{row.detectMs}</td>
              <td className="py-1.5 pr-3">{row.modelMs}</td>
              <td className="py-1.5 pr-3">{row.sentenceMs}</td>
              <td className="py-1.5 pr-3">{row.voiceMs}</td>
              <td className="py-1.5 text-fg">{row.totalMs}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
