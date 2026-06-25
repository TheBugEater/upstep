"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
  /** Pass false to hide the Open/In Progress status filter (e.g. Completed tab). */
  showStatusFilter?: boolean;
  lead?: React.ReactNode;
}

type SortMode = "newest" | "votes";

const TYPES: FeedbackType[] = ["BUG", "FEATURE", "GENERAL"];
const ACTIVE_STATUSES: FeedbackStatus[] = ["OPEN", "IN_PROGRESS"];

export function FeedbackTable({ projectId, feedback, showStatusFilter = true, lead }: Props) {
  const [items, setItems] = useState(feedback);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Client-side filter state — instant, no network round-trip
  const [filterType, setFilterType] = useState<FeedbackType | "ALL">("ALL");
  const [filterStatus, setFilterStatus] = useState<FeedbackStatus | "ALL">("ALL");
  const [sortBy, setSortBy] = useState<SortMode>("newest");

  const [commentsByFid, setCommentsByFid] = useState<Record<string, Comment[]>>({});
  const [inputByFid, setInputByFid] = useState<Record<string, string>>({});
  const [postingFid, setPostingFid] = useState<string | null>(null);

  // Add-task form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addContent, setAddContent] = useState("");
  const [addType, setAddType] = useState<FeedbackType>("FEATURE");
  const [addStatus, setAddStatus] = useState<FeedbackStatus>("OPEN");
  const [addInternal, setAddInternal] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  // Re-sync when server passes new data (e.g. tab switch / page nav)
  useEffect(() => {
    setItems(feedback);
    setExpanded(null);
  }, [feedback]);

  // Derive filtered + sorted view — runs in-memory, no fetches
  const displayedItems = useMemo(() => {
    let result = items;
    if (filterType !== "ALL") result = result.filter((f) => f.type === filterType);
    if (filterStatus !== "ALL") result = result.filter((f) => f.status === filterStatus);
    return sortBy === "votes"
      ? [...result].sort((a, b) => b.upvotes - a.upvotes)
      : [...result].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [items, filterType, filterStatus, sortBy]);

  // Counts for status badge hints
  const openCount = useMemo(() => items.filter((f) => f.status === "OPEN").length, [items]);
  const inProgressCount = useMemo(() => items.filter((f) => f.status === "IN_PROGRESS").length, [items]);

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

  function openAddForm() {
    setAddTitle("");
    setAddContent("");
    setAddType("FEATURE");
    setAddStatus("OPEN");
    setAddInternal(false);
    setShowAddForm(true);
    setTimeout(() => titleRef.current?.focus(), 0);
  }

  async function submitAddTask(e: React.FormEvent) {
    e.preventDefault();
    const content = addTitle.trim() || addContent.trim();
    if (!content || addSaving) return;
    setAddSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: addTitle.trim() || undefined,
          content: addContent.trim() || addTitle.trim(),
          type: addType,
          status: addStatus,
          internal: addInternal,
        }),
      });
      if (res.ok) {
        const created = (await res.json()) as Feedback;
        setItems((prev) => [created, ...prev]);
        setShowAddForm(false);
      }
    } finally {
      setAddSaving(false);
    }
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

  const activeBtn = "bg-ink text-white";
  const inactiveBtn = "bg-card text-muted hover:text-ink";

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {lead}

        {/* Type filter */}
        <div className="flex gap-1 bg-card border border-line rounded-xl p-1">
          <button
            onClick={() => setFilterType("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterType === "ALL" ? activeBtn : inactiveBtn}`}
          >
            All
          </button>
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(filterType === t ? "ALL" : t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterType === t ? activeBtn : inactiveBtn}`}
            >
              {t.charAt(0) + t.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Status filter — hidden for Completed tab */}
        {showStatusFilter && (
          <div className="flex gap-1 bg-card border border-line rounded-xl p-1">
            {ACTIVE_STATUSES.map((s) => {
              const count = s === "OPEN" ? openCount : inProgressCount;
              return (
                <button
                  key={s}
                  onClick={() => setFilterStatus(filterStatus === s ? "ALL" : s)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterStatus === s ? activeBtn : inactiveBtn}`}
                >
                  {s === "IN_PROGRESS" ? "In progress" : "Open"}
                  {count > 0 && (
                    <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none ${filterStatus === s ? "bg-white/20 text-white" : "bg-line text-faint"}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Sort toggle */}
        <button
          onClick={() => setSortBy(sortBy === "votes" ? "newest" : "votes")}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${sortBy === "votes" ? "bg-ink text-white border-transparent" : "bg-card text-muted border-line hover:text-ink"}`}
        >
          {sortBy === "votes" ? "Top voted" : "Newest"}
        </button>

        {/* Add task button */}
        <button
          onClick={openAddForm}
          className="ml-auto px-3.5 py-1.5 rounded-xl bg-clay text-white text-xs font-semibold hover:bg-clay-hover transition shadow-soft"
        >
          + Add task
        </button>
      </div>

      {/* Inline add-task form */}
      {showAddForm && (
        <form
          onSubmit={(e) => void submitAddTask(e)}
          className="mb-3 rounded-2xl border border-clay/30 bg-card shadow-soft p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-ink">New task</span>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs text-faint hover:text-ink transition"
            >
              ✕
            </button>
          </div>

          {/* Title */}
          <input
            ref={titleRef}
            type="text"
            value={addTitle}
            onChange={(e) => setAddTitle(e.target.value)}
            placeholder="Title (required)"
            maxLength={200}
            required
            className="w-full text-sm rounded-xl border border-line bg-surface px-3 py-2 text-ink placeholder:text-faint focus:outline-none focus:border-clay/40 transition mb-2"
          />

          {/* Description */}
          <textarea
            value={addContent}
            onChange={(e) => setAddContent(e.target.value)}
            placeholder="Description (optional)"
            maxLength={2000}
            rows={2}
            className="w-full text-sm rounded-xl border border-line bg-surface px-3 py-2 text-ink placeholder:text-faint focus:outline-none focus:border-clay/40 transition resize-none mb-3"
          />

          {/* Type + Status row */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex gap-1">
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setAddType(t)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition ${addType === t ? TYPE_COLORS[t] : "bg-card text-muted border-line hover:border-line-strong"}`}
                >
                  {t.charAt(0) + t.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {ACTIVE_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setAddStatus(s)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition ${addStatus === s ? STATUS_COLORS[s] : "bg-card text-muted border-line hover:border-line-strong"}`}
                >
                  {s === "IN_PROGRESS" ? "In progress" : "Open"}
                </button>
              ))}
            </div>

            {/* Internal toggle */}
            <button
              type="button"
              onClick={() => setAddInternal((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition ${addInternal ? "bg-violet-50 text-violet-700 border-violet-200" : "bg-card text-muted border-line hover:border-line-strong"}`}
            >
              <span className="text-[10px]">&#128274;</span>
              Dev only
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={addSaving || !addTitle.trim()}
              className="px-4 py-2 rounded-xl bg-ink text-white text-sm font-medium hover:bg-ink/80 transition disabled:opacity-40"
            >
              {addSaving ? "Adding…" : "Add task"}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-xl border border-line text-sm text-muted hover:text-ink transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {displayedItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong bg-card/50 text-center py-20 text-muted text-sm">
          {items.length === 0 ? "No feedback yet." : "No feedback matches these filters."}
        </div>
      ) : (
        <div className="space-y-2">
          {displayedItems.map((f) => {
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
                    {f.internal && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold border bg-violet-50 text-violet-700 border-violet-200">
                        Dev only
                      </span>
                    )}
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
                          {f.flagged ? "Flagged for profanity. Review before approving." : "Awaiting moderation review."}
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
                      {ACTIVE_STATUSES.map((s) => (
                        <button
                          key={s}
                          onClick={() => updateStatus(f.id, s)}
                          className={`text-xs px-2.5 py-1 rounded-full font-medium transition border ${f.status === s ? STATUS_COLORS[s] : "bg-card text-muted border-line hover:border-line-strong"}`}
                        >
                          {s === "IN_PROGRESS" ? "In progress" : "Open"}
                        </button>
                      ))}
                      <button
                        onClick={() => updateStatus(f.id, "DONE")}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium transition border ${f.status === "DONE" ? STATUS_COLORS["DONE"] : "bg-card text-muted border-line hover:border-line-strong"}`}
                      >
                        Done
                      </button>
                      <button
                        onClick={async () => {
                          const res = await fetch(`/api/projects/${projectId}/feedback/${f.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ internal: !f.internal }),
                          });
                          if (res.ok) {
                            const updated = (await res.json()) as Feedback;
                            setItems((prev) => prev.map((i) => (i.id === f.id ? updated : i)));
                          }
                        }}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium transition border ${f.internal ? "bg-violet-50 text-violet-700 border-violet-200" : "bg-card text-muted border-line hover:border-line-strong"}`}
                      >
                        {f.internal ? "Dev only (visible to devs)" : "Make dev only"}
                      </button>
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
