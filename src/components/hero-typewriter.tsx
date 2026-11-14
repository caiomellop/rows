"use client";

import { useEffect, useState } from "react";

const TYPE_MS = 55;
const DELETE_MS = 28;
const HOLD_MS = 2200;
const GAP_MS = 350;

/**
 * Accent line of the hero h1 (spec §5). Every phrase is rendered invisibly in the
 * same grid cell so the line is as wide as the longest phrase and never jumps.
 * Server render and reduced-motion users get the first phrase, fully typed.
 */
export function HeroTypewriter({ phrases }: { phrases: string[] }) {
  const [index, setIndex] = useState(0);
  const [length, setLength] = useState(phrases[0].length);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const phrase = phrases[index];
    let delay: number;
    let next: () => void;

    if (!deleting && length === phrase.length) {
      delay = HOLD_MS;
      next = () => setDeleting(true);
    } else if (deleting && length === 0) {
      delay = GAP_MS;
      next = () => {
        setDeleting(false);
        setIndex((i) => (i + 1) % phrases.length);
      };
    } else {
      delay = deleting ? DELETE_MS : TYPE_MS;
      next = () => setLength((l) => l + (deleting ? -1 : 1));
    }

    const id = window.setTimeout(next, delay);
    return () => window.clearTimeout(id);
  }, [deleting, index, length, phrases]);

  const caret = <span className="caret" />;

  return (
    <span className="grid text-accent sm:whitespace-nowrap">
      {phrases.map((p) => (
        <span key={p} className="invisible [grid-area:1/1]">
          {p}
          {caret}
        </span>
      ))}
      <span className="[grid-area:1/1]">
        {phrases[index].slice(0, length)}
        {caret}
      </span>
    </span>
  );
}
