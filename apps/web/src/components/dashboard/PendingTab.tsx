"use client";

import { useState } from "react";
import type { Feedback, FeedbackStatus, FeedbackType } from "@upstep/types";

const TYPE_COLORS: Record<FeedbackType, string> = {
  BUG: "bg-red-50 text-red-600 border-red-100",
  FEATURE: "bg-blue-50 text-blue-600 border-blue-100",
  GENERAL: "bg-surface text-muted border-line",
};

interface Props {
  projectId: string;
  initialItems: Feedback[];
}

export function PendingTab({ projectId, initialItems }: Props) {
  const [items, setItems] = useState(initialItems);

  async function decide(id: string, status: FeedbackStatus) {
    const res = await fetch(`/api/projects/${projectId}/feedback/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setItems((prev) => prev.filter((f) => f.id !== id));
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
          className="bg-card border border-line rounded-2xl p-5 shadow-soft"
        >
          <div className="flex items-start gap-4">
            {/* Upvote pill */}
            <div className="flex flex-col items-center justify-center w-11 shrink-0 rounded-xl border border-line bg-surface/60 py-1.5">
              <span className="text-clay text-[11px] leading-none">▲</span>
              <span className="text-sm font-semibold text-ink leading-tight">{f.upvotes}</span>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm text-ink leading-relaxed">{f.content}</p>

              <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${TYPE_COLORS[f.type]}`}>
                  {f.type}
                </span>
                {f.flagged && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium border bg-orange-50 text-orange-600 border-orange-100">
                    ⚑ Profanity flagged
                  </span>
                )}
                <span className="text-xs text-faint">
                  {new Date(f.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => decide(f.id, "OPEN")}
                className="text-xs px-4 py-2 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition"
              >
                Approve
              </button>
              <button
                onClick={() => decide(f.id, "CLOSED")}
                className="text-xs px-4 py-2 rounded-xl bg-card text-muted border border-line font-semibold hover:text-ink hover:border-line-strong transition"
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
