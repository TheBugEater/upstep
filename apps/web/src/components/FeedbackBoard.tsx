"use client";

import { useState, useRef, useEffect } from "react";
import type { Comment, Feedback, FeedbackStatus, FeedbackType } from "@upstep/types";

const TYPE_COLORS: Record<FeedbackType, string> = {
  BUG: "bg-red-50 text-red-600 border-red-100",
  FEATURE: "bg-blue-50 text-blue-600 border-blue-100",
  GENERAL: "bg-surface text-muted border-line",
};

const STATUS_ACTIVE: Record<string, string> = {
  OPEN: "bg-amber-50 text-amber-700 border-amber-300",
  IN_PROGRESS: "bg-blue-50 text-blue-700 border-blue-300",
  DONE: "bg-green-50 text-green-700 border-green-300",
};

type Column = {
  status: FeedbackStatus;
  label: string;
  dot: string;
  headTint: string;
};

const COLUMNS: Column[] = [
  { status: "OPEN", label: "Open", dot: "bg-amber-400", headTint: "text-amber-700" },
  { status: "IN_PROGRESS", label: "In progress", dot: "bg-blue-400", headTint: "text-blue-600" },
  { status: "DONE", label: "Done", dot: "bg-green-500", headTint: "text-green-700" },
];

interface Props {
  projectId: string;
  feedback: Feedback[];
}

export function FeedbackBoard({ projectId, feedback }: Props) {
  const [items, setItems] = useState(feedback);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<FeedbackStatus | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const draggingRef = useRef(false);

  const selectedItem = items.find((f) => f.id === selectedId) ?? null;

  async function move(id: string, status: FeedbackStatus) {
    const current = items.find((f) => f.id === id);
    if (!current || current.status === status) return;

    setItems((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)));

    const res = await fetch(`/api/projects/${projectId}/feedback/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      setItems((prev) => prev.map((f) => (f.id === id ? { ...f, status: current.status } : f)));
    }
  }

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
        {COLUMNS.map((col) => {
          const colItems = items.filter((f) => f.status === col.status);
          const isOver = overCol === col.status;
          return (
            <div
              key={col.status}
              onDragOver={(e) => {
                e.preventDefault();
                setOverCol(col.status);
              }}
              onDragLeave={() => setOverCol((c) => (c === col.status ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) move(dragId, col.status);
                setDragId(null);
                setOverCol(null);
              }}
              className={`flex-shrink-0 w-72 rounded-2xl border transition-colors ${
                isOver ? "border-clay/50 bg-clay-tint/40" : "border-line bg-surface/40"
              }`}
            >
              {/* Column header */}
              <div className="flex items-center gap-2 px-4 h-12 border-b border-line">
                <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                <span className={`text-sm font-semibold ${col.headTint}`}>{col.label}</span>
                <span className="ml-auto text-xs font-medium text-faint bg-card border border-line rounded-full px-2 py-0.5">
                  {colItems.length}
                </span>
              </div>

              {/* Cards */}
              <div className="p-2.5 space-y-2.5 min-h-[120px]">
                {colItems.length === 0 ? (
                  <div className="text-center text-xs text-faint py-8">
                    {isOver ? "Drop here" : "Nothing here"}
                  </div>
                ) : (
                  colItems.map((f) => (
                    <article
                      key={f.id}
                      draggable
                      onDragStart={() => {
                        setDragId(f.id);
                        draggingRef.current = true;
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverCol(null);
                        setTimeout(() => { draggingRef.current = false; }, 0);
                      }}
                      onClick={() => {
                        if (!draggingRef.current) setSelectedId(f.id);
                      }}
                      className={`group bg-card border border-line rounded-xl p-3 shadow-soft cursor-pointer hover:border-line-strong hover:shadow-md transition ${
                        dragId === f.id ? "opacity-50 !cursor-grab" : ""
                      }`}
                    >
                      <p className="text-sm font-semibold text-ink leading-snug line-clamp-2">
                        {f.title ?? f.content}
                      </p>
                      {f.title && (
                        <p className="text-xs text-muted mt-1 line-clamp-2 leading-snug">{f.content}</p>
                      )}

                      <div className="flex items-center gap-2 mt-2.5">
                        <span className="inline-flex items-center gap-1 text-clay text-xs font-semibold">
                          <span className="text-[10px]">▲</span>
                          {f.upvotes}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${TYPE_COLORS[f.type]}`}
                        >
                          {f.type}
                        </span>
                        {f.flagged && (
                          <span
                            title="Flagged by the profanity filter"
                            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium border bg-orange-50 text-orange-600 border-orange-100"
                          >
                            ⚑
                          </span>
                        )}
                        <span className="ml-auto text-[10px] text-faint">
                          {new Date(f.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedItem && (
        <BoardDetail
          key={selectedItem.id}
          item={selectedItem}
          projectId={projectId}
          onClose={() => setSelectedId(null)}
          onStatusChange={(id, status) => move(id, status)}
          onDelete={(id) => {
            setItems((prev) => prev.filter((f) => f.id !== id));
            setSelectedId(null);
          }}
        />
      )}
    </>
  );
}

// ─── Board detail drawer ──────────────────────────────────────────────────────

function BoardDetail({
  item,
  projectId,
  onClose,
  onStatusChange,
  onDelete,
}: {
  item: Feedback;
  projectId: string;
  onClose: () => void;
  onStatusChange: (id: string, status: FeedbackStatus) => void;
  onDelete: (id: string) => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [input, setInput] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/feedback/${item.id}/comments`)
      .then((r) => r.json())
      .then((data: unknown) => setComments(Array.isArray(data) ? (data as Comment[]) : []))
      .catch(() => {});
  }, [item.id, projectId]);

  async function postComment() {
    if (!input.trim() || posting) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/feedback/${item.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: input }),
      });
      if (res.ok) {
        const c = (await res.json()) as Comment;
        setComments((prev) => [...prev, c]);
        setInput("");
      }
    } finally {
      setPosting(false);
    }
  }

  async function deleteItem() {
    if (!confirm("Delete this feedback item?")) return;
    await fetch(`/api/projects/${projectId}/feedback/${item.id}`, { method: "DELETE" });
    onDelete(item.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-md bg-canvas border-l border-line shadow-lift flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 h-14 border-b border-line shrink-0">
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${TYPE_COLORS[item.type]}`}>
            {item.type}
          </span>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink transition text-xl leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {item.title && (
            <h2 className="font-serif text-xl text-ink font-semibold leading-snug">{item.title}</h2>
          )}
          <p className="text-sm text-ink-soft leading-relaxed">{item.content}</p>

          <div className="inline-flex items-center gap-1.5 text-clay text-sm font-semibold">
            <span className="text-xs">▲</span>
            {item.upvotes} {item.upvotes === 1 ? "upvote" : "upvotes"}
          </div>

          {/* Status */}
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Status</p>
            <div className="flex flex-wrap gap-2">
              {(["OPEN", "IN_PROGRESS", "DONE"] as FeedbackStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => onStatusChange(item.id, s)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium border transition ${
                    item.status === s
                      ? STATUS_ACTIVE[s]
                      : "bg-card border-line text-muted hover:border-line-strong"
                  }`}
                >
                  {s.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Comments */}
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">
              Developer response
            </p>
            {comments.length === 0 ? (
              <p className="text-xs text-faint mb-3">No responses yet.</p>
            ) : (
              <div className="space-y-2 mb-3">
                {comments.map((c) => (
                  <div key={c.id} className="bg-surface rounded-xl border border-line p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-clay">
                        {c.authorName ?? "You"}
                      </span>
                      <span className="text-xs text-faint">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-ink-soft">{c.content}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    postComment();
                  }
                }}
                placeholder="Reply as developer…"
                className="flex-1 text-sm rounded-xl border border-line bg-surface px-3 py-2 focus:outline-none focus:border-clay/50 transition"
              />
              <button
                onClick={postComment}
                disabled={posting || !input.trim()}
                className="px-4 py-2 rounded-xl bg-ink text-white text-sm font-medium hover:bg-ink/80 disabled:opacity-40 transition"
              >
                Post
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-line shrink-0 flex items-center justify-between">
          <span className="text-xs text-faint">
            {new Date(item.createdAt).toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          <button onClick={deleteItem} className="text-xs text-red-400 hover:text-red-600 transition">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
