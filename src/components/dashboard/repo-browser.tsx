"use client";

import { useMemo, useState, useTransition } from "react";

import type { ActionResult } from "@/app/dashboard/actions";
import { relativeTime } from "@/lib/insights";

export type RepoRow = {
  id: string;
  name: string;
  description: string | null;
  primaryLanguage: string | null;
  stars: number;
  pushedAt: Date | null;
  isFork: boolean;
  isArchived: boolean;
  pinned: boolean;
};

export function RepoBrowser({
  repos,
  setPinned,
  canPinMore,
}: {
  repos: RepoRow[];
  setPinned: (projectId: string, pinned: boolean) => Promise<ActionResult>;
  canPinMore: boolean;
}) {
  const [query, setQuery] = useState("");
  const [showForks, setShowForks] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return repos.filter(
      (r) =>
        !r.pinned &&
        (showForks || !r.isFork) &&
        (!q || r.name.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q) || r.primaryLanguage?.toLowerCase().includes(q)),
    );
  }, [repos, query, showForks]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name, language or description"
          aria-label="Filter repositories"
          className="field max-w-sm flex-1"
        />
        <label className="flex items-center gap-2 text-[14px] text-fg-2">
          <input type="checkbox" checked={showForks} onChange={(e) => setShowForks(e.target.checked)} />
          Show forks
        </label>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-[13px] text-red-700">
          {error}
        </p>
      ) : null}
      <ul className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
        {visible.length === 0 ? <li className="p-4 text-[14px] text-fg-3">No repos match.</li> : null}
        {visible.map((r) => (
          <li key={r.id} className="flex items-center gap-4 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium text-fg">
                {r.name}
                {r.isFork ? <span className="ml-2 text-[12px] font-normal text-fg-3">fork</span> : null}
                {r.isArchived ? <span className="ml-2 text-[12px] font-normal text-fg-3">archived</span> : null}
              </p>
              <p className="truncate text-[13px] text-fg-3">
                {[r.primaryLanguage, r.stars ? `${r.stars}★` : null, r.pushedAt ? `pushed ${relativeTime(new Date(r.pushedAt))}` : null, r.description]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <button
              type="button"
              className="btn-secondary h-8 shrink-0 rounded-lg px-3 text-[13px]"
              disabled={busy !== null || !canPinMore}
              title={canPinMore ? undefined : "Unpin a project first"}
              onClick={() => {
                setBusy(r.id);
                setError(null);
                startTransition(async () => {
                  const result = await setPinned(r.id, true);
                  if (!result.ok) setError(result.error);
                  setBusy(null);
                });
              }}
            >
              {busy === r.id ? "Pinning…" : "Pin"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
