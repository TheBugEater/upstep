"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Comment, Feedback, FeedbackStatus, FeedbackType } from "@upstep/types";

const TYPE_COLORS: Record<FeedbackType, string> = {
  BUG: "bg-red-50 text-red-600 border-red-100",
  FEATURE: "bg-blue-50 text-blue-600 border-blue-100",
  GENERAL: "bg-surface text-muted border-line",
};

const STATUS_COLORS: Record<FeedbackStatus, string> = {
  PENDING: "bg-orange-50 text-orange-600 border-orange-100",
  OPEN: "bg-amber-50 text-amber-700 border-amber-100",
  IN_PROGRESS: "bg-blue-50 text-blue-600 border-blue-100",
  DONE: "bg-green-50 text-green-700 border-green-100",
  CLOSED: "bg-surface text-muted border-line",
};

interface Props {
  projectId: string;
  feedback: Feedback[];
  currentType: string | undefined;
  currentStatus: string | undefined;
  currentSort: string | undefined;
}

export function FeedbackTable({ projectId, feedback, currentType, currentStatus, currentSort }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(feedback);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [commentsByFid, setCommentsByFid] = useState<Record<string, Comment[]>>({});
  const [inputByFid, setInputByFid] = useState<Record<string, string>>({});
  const [postingFid, setPostingFid] = useState<string | null>(null);

  function buildUrl(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged = { type: currentType, status: currentStatus, sort: currentSort, ...overrides };
    Object.entries(merged).forEach(([k, v]) => { if (v) params.set(k, v); });
    return `/dashboard/projects/${projectId}?${params}`;
  }

  async function toggleExpanded(id: string) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!commentsByFid[id]) {
      try {
        const res = await fetch(`/api/projects/${projectId}/feedback/${id}/comments`);
        if (res.ok) {
          const data = (await res.json()) as Comment[];
          setCommentsByFid((prev) => ({ ...prev, [id]: data }));
        }
      } catch { /* non-critical */ }
    }
  }

  async function updateStatus(id: string, status: FeedbackStatus) {
    const res = await fetch(`/api/projects/${projectId}/feedback/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated = (await res.json()) as Feedback;
      setItems((prev) => prev.map((f) => (f.id === id ? updated : f)));
    }
  }

  async function deleteFeedback(id: string) {
    if (!confirm("Delete this feedback item?")) return;
    const res = await fetch(`/api/projects/${projectId}/feedback/${id}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => prev.filter((f) => f.id !== id));
  }

  async function postComment(id: string) {
    const content = inputByFid[id]?.trim();
    if (!content || postingFid === id) return;
    setPostingFid(id);
    try {
      const res = await fetch(`/api/projects/${projectId}/feedback/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const comment = (await res.json()) as Comment;
        setCommentsByFid((prev) => ({ ...prev, [id]: [...(prev[id] ?? []), comment] }));
        setInputByFid((prev) => ({ ...prev, [id]: "" }));
      }
    } finally {
      setPostingFid(null);
    }
  }

  const TYPES: FeedbackType[] = ["BUG", "FEATURE", "GENERAL"];
  const STATUSES: FeedbackStatus[] = ["OPEN", "IN_PROGRESS", "DONE"];

  const activeBtn = "bg-ink text-white";
  const inactiveBtn = "bg-card text-muted hover:text-ink";

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-6">
        <div className="flex gap-1 bg-card border border-line rounded-xl p-1">
          <button
            onClick={() => router.push(buildUrl({ type: undefined }))}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${!currentType ? activeBtn : inactiveBtn}`}
          >
            All
          </button>
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => router.push(buildUrl({ type: currentType === t ? undefined : t }))}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${currentType === t ? activeBtn : inactiveBtn}`}
            >
              {t.charAt(0) + t.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="flex gap-1 bg-card border border-line rounded-xl p-1">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => router.push(buildUrl({ status: currentStatus === s ? undefined : s }))}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${currentStatus === s ? activeBtn : inactiveBtn}`}
            >
              {s.replace("_", " ").charAt(0) + s.replace("_", " ").slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <button
          onClick={() => router.push(buildUrl({ sort: currentSort === "votes" ? undefined : "votes" }))}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${currentSort === "votes" ? "bg-ink text-white border-transparent" : "bg-card text-muted border-line hover:text-ink"}`}
        >
          {currentSort === "votes" ? "Sorted by votes" : "Sorted by newest"}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong bg-card/50 text-center py-20 text-muted text-sm">
          No feedback matches these filters.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((f) => {
            const title = f.title ?? f.content;
            const hasDesc = Boolean(f.title);
            const itemComments = commentsByFid[f.id] ?? [];

            return (
              <div key={f.id} className="bg-card border border-line rounded-2xl overflow-hidden shadow-soft hover:border-line-strong transition">
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-surface/60 transition"
                  onClick={() => toggleExpanded(f.id)}
                >
                  <div className="flex flex-col items-center justify-center w-11 shrink-0 rounded-xl border border-line bg-surface/60 py-1.5">
                    <span className="text-clay text-[11px] leading-none">▲</span>
                    <span className="text-sm font-semibold text-ink leading-tight">{f.upvotes}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink font-medium truncate">{title}</p>
                    {hasDesc && (
                      <p className="text-xs text-muted truncate mt-0.5">{f.content}</p>
                    )}
                    <p className="text-xs text-faint mt-0.5">{new Date(f.createdAt).toLocaleDateString()}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`hidden sm:inline text-[10px] px-2 py-0.5 rounded-full font-medium border ${TYPE_COLORS[f.type]}`}>{f.type}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${STATUS_COLORS[f.status]}`}>{f.status.replace("_", " ")}</span>
                  </div>
                </div>

                {expanded === f.id && (
                  <div className="px-5 pb-5 border-t border-line">
                    {hasDesc && (
                      <p className="text-sm text-ink-soft mb-4 mt-3 leading-relaxed">{f.content}</p>
                    )}

                    {f.status === "PENDING" && (
                      <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-orange-50 border border-orange-100">
                        <span className="text-xs text-orange-700 font-medium flex-1">
                          {f.flagged ? "⚑ Flagged for profanity — review before approving." : "Awaiting moderation review."}
                        </span>
                        <button
                          onClick={() => updateStatus(f.id, "OPEN")}
                          className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateStatus(f.id, "CLOSED")}
                          className="text-xs px-3 py-1.5 rounded-lg bg-card text-muted border border-line font-medium hover:text-ink hover:border-line-strong transition"
                        >
                          Reject
                        </button>
                      </div>
                    )}

                    {!hasDesc && (
                      <p className="text-sm text-ink-soft mb-4 mt-3 leading-relaxed">{f.content}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 mb-5">
                      <span className="text-xs text-muted font-medium">Status:</span>
                      {STATUSES.map((s) => (
                        <button
                          key={s}
                          onClick={() => updateStatus(f.id, s)}
                          className={`text-xs px-2.5 py-1 rounded-full font-medium transition border ${f.status === s ? STATUS_COLORS[s] : "bg-card text-muted border-line hover:border-line-strong"}`}
                        >
                          {s.replace("_", " ")}
                        </button>
                      ))}
                      <button
                        onClick={() => deleteFeedback(f.id)}
                        className="ml-auto text-xs text-red-400 hover:text-red-600 transition"
                      >
                        Delete
                      </button>
                    </div>

                    {/* Developer comments */}
                    <div className="pt-4 border-t border-line">
                      <p className="text-[10px] font-semibold tracking-widest text-faint uppercase mb-3">
                        Developer response
                      </p>

                      {itemComments.length > 0 && (
                        <div className="space-y-2 mb-3">
                          {itemComments.map((c) => (
                            <div key={c.id} className="bg-surface rounded-xl border border-line p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[11px] font-semibold text-clay">{c.authorName ?? "You"}</span>
                                <span className="text-[11px] text-faint">{new Date(c.createdAt).toLocaleDateString()}</span>
                              </div>
                              <p className="text-sm text-ink-soft leading-relaxed">{c.content}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <input
                          value={inputByFid[f.id] ?? ""}
                          onChange={(e) => setInputByFid((prev) => ({ ...prev, [f.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void postComment(f.id); }
                          }}
                          placeholder="Reply to this feedback…"
                          className="flex-1 text-sm rounded-xl border border-line bg-surface px-3 py-2 text-ink placeholder:text-faint focus:outline-none focus:border-clay/40 transition"
                        />
                        <button
                          onClick={() => void postComment(f.id)}
                          disabled={postingFid === f.id || !inputByFid[f.id]?.trim()}
                          className="px-4 py-2 rounded-xl bg-ink text-white text-sm font-medium hover:bg-ink/80 transition disabled:opacity-40"
                        >
                          Post
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
