"use client";

import { useState } from "react";
import type { WorkspaceItem } from "@/types/dashboard";
import { TypePill, relativeDate } from "./ui";

interface Props {
  items: WorkspaceItem[];
  onDecide: (id: string, approve: boolean) => Promise<void>;
}

export function PendingList({ items, onDecide }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function decide(id: string, approve: boolean) {
    setBusyId(id);
    try {
      await onDecide(id, approve);
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong bg-card/50 text-center py-20">
        <div className="text-2xl mb-2">✓</div>
        <div className="text-sm font-medium text-ink">All clear</div>
        <div className="text-xs text-muted mt-1">No feedback waiting for review.</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((f) => (
        <div
          key={f.id}
          className={`bg-card border border-line rounded-2xl p-5 shadow-soft ${
            busyId === f.id ? "opacity-60" : ""
          }`}
        >
          <div className="flex items-start gap-4">
            <div className="flex flex-col items-center justify-center w-11 shrink-0 rounded-xl border border-line bg-surface/60 py-1.5">
              <span className="text-clay text-[11px] leading-none">▲</span>
              <span className="text-sm font-semibold text-ink leading-tight">{f.upvotes}</span>
            </div>

            <div className="flex-1 min-w-0">
              {f.title && <p className="text-sm font-semibold text-ink leading-snug">{f.title}</p>}
              <p className="text-sm text-ink leading-relaxed">{f.content}</p>

              <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                <TypePill type={f.type} />
                {f.flagged && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium border bg-orange-50 text-orange-600 border-orange-100">
                    ⚑ Profanity flagged
                  </span>
                )}
                <span className="text-xs text-faint">{relativeDate(f.createdAt)}</span>
              </div>
            </div>

            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => void decide(f.id, true)}
                disabled={busyId === f.id}
                className="text-xs px-4 py-2 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-60 transition"
              >
                Approve
              </button>
              <button
                onClick={() => void decide(f.id, false)}
                disabled={busyId === f.id}
                className="text-xs px-4 py-2 rounded-xl bg-card text-muted border border-line font-semibold hover:text-ink hover:border-line-strong disabled:opacity-60 transition"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
