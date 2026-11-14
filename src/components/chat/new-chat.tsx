"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";

import { startChat, startStarter } from "@/app/(app)/dashboard/actions";
import { useIconHover } from "@/components/icons/animated";
import { STARTERS, type Starter } from "@/config/starters";

function Send() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary h-10 rounded-lg px-4 text-[14px]" disabled={pending}>
      {pending ? "Starting…" : "Send"}
    </button>
  );
}

function StarterCard({ starter }: { starter: Starter }) {
  const { ref, hover } = useIconHover();
  const Icon = starter.icon;
  return (
    <form action={startStarter.bind(null, starter.id)}>
      <button
        type="submit"
        className="flex h-full w-full items-center gap-3 rounded-xl border border-line bg-card px-4 py-3 text-left text-[14px] text-fg-2 outline-none transition-colors hover:border-ink/20 hover:text-fg focus-visible:ring-2 focus-visible:ring-ink/60"
        {...hover}
      >
        <Icon ref={ref} size={18} className="shrink-0 [&_svg]:[stroke-width:1.6]" />
        {starter.title}
      </button>
    </form>
  );
}

/** The empty chat screen: a composer, and the starters as one-click shortcuts. */
export function NewChat({ greeting, aiEnabled }: { greeting: string; aiEnabled: boolean }) {
  const form = useRef<HTMLFormElement>(null);

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col justify-center pb-[10vh]">
      <h1 className="text-center text-[2.2rem] leading-[1.1] text-fg">{greeting}</h1>

      {aiEnabled ? (
        <>
          <form ref={form} action={startChat} className="surface mt-8 flex items-end gap-2 p-3">
            <textarea
              name="text"
              required
              rows={2}
              maxLength={4000}
              autoFocus
              placeholder="Ask anything about your profile, resume or next interview…"
              aria-label="Your message"
              className="field flex-1 resize-none border-transparent bg-transparent focus:border-transparent focus:shadow-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  form.current?.requestSubmit();
                }
              }}
            />
            <Send />
          </form>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {STARTERS.map((s) => (
              <StarterCard key={s.id} starter={s} />
            ))}
          </div>
        </>
      ) : (
        <p className="surface mt-8 p-5 text-center text-[14px] text-fg-2">The assistant needs ANTHROPIC_API_KEY to be set.</p>
      )}
    </div>
  );
}
