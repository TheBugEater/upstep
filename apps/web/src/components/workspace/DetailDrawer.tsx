"use client";

import { useEffect, useState } from "react";
import type { Comment, Label } from "@upstep/types";
import type { ProjectStatus, WorkspaceItem } from "@/types/dashboard";
import type { WorkspaceActions } from "./ProjectWorkspace";
import { TYPES, TYPE_COLORS, TYPE_LABELS, LABEL_PALETTE, inputCls } from "./ui";

interface Props {
  item: WorkspaceItem;
  projectId: string;
  statuses: ProjectStatus[];
  projectLabels: Label[];
  actions: WorkspaceActions;
  onClose: () => void;
}

export function DetailDrawer({ item, projectId, statuses, projectLabels, actions, onClose }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [input, setInput] = useState("");
  const [posting, setPosting] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState(LABEL_PALETTE[0]!);
  const [showNewLabel, setShowNewLabel] = useState(false);
  const [savingLabel, setSavingLabel] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const itemLabels = item.labels ?? [];

  useEffect(() => {
    fetch(`/api/projects/${projectId}/feedback/${item.id}/comments`)
      .then((r) => r.json())
      .then((data: unknown) => setComments(Array.isArray(data) ? (data as Comment[]) : []))
      .catch(() => {});
  }, [item.id, projectId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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

  async function addNewLabel() {
    const name = newLabelName.trim();
    if (!name || savingLabel) return;
    setSavingLabel(true);
    try {
      const label = await actions.createLabel(name, newLabelColor);
      if (label && !itemLabels.some((l) => l.id === label.id)) {
        await actions.toggleItemLabel(item.id, label, false);
      }
      setNewLabelName("");
      setShowNewLabel(false);
    } finally {
      setSavingLabel(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 w-full sm:max-w-md bg-canvas border-l border-line shadow-lift flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 h-14 border-b border-line shrink-0">
          <div className="flex gap-1">
            {TYPES.map((t) => (
              <button
                key={t}
                onClick={() => void actions.updateItem(item.id, { type: t })}
                className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border transition ${
                  item.type === t
                    ? TYPE_COLORS[t]
                    : "bg-card text-faint border-line hover:border-line-strong hover:text-muted"
                }`}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
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
          <p className="text-sm text-ink-soft leading-relaxed whitespace-pre-wrap">{item.content}</p>

          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-clay text-sm font-semibold">
              <span className="text-xs">▲</span>
              {item.upvotes} {item.upvotes === 1 ? "upvote" : "upvotes"}
            </span>
            {(item.downvotes ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1.5 text-muted text-sm">
                <span className="text-xs">▼</span>
                {item.downvotes}
              </span>
            )}
          </div>

          {/* Status */}
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Status</p>
            <div className="flex flex-wrap gap-2">
              {statuses.map((s) => {
                const isActive = item.statusId === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => actions.moveItem(item.id, s.id)}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium border transition ${
                      isActive
                        ? "text-white border-transparent"
                        : "bg-card border-line text-muted hover:border-line-strong"
                    }`}
                    style={isActive ? { backgroundColor: s.color, borderColor: s.color } : {}}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Labels */}
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Labels</p>
            <div className="flex flex-wrap gap-2">
              {projectLabels.map((l) => {
                const has = itemLabels.some((x) => x.id === l.id);
                return (
                  <button
                    key={l.id}
                    onClick={() => void actions.toggleItemLabel(item.id, l, has)}
                    className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border transition ${
                      has
                        ? "text-white border-transparent"
                        : "bg-card border-line text-muted hover:border-line-strong"
                    }`}
                    style={has ? { backgroundColor: l.color, borderColor: l.color } : {}}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: has ? "rgba(255,255,255,0.7)" : l.color }}
                    />
                    {l.name}
                  </button>
                );
              })}
              <button
                onClick={() => setShowNewLabel((v) => !v)}
                className="text-xs px-2.5 py-1 rounded-full border border-dashed border-line text-faint hover:text-muted hover:border-line-strong transition"
              >
                + New label
              </button>
            </div>

            {showNewLabel && (
              <div className="mt-3 rounded-xl border border-line bg-card p-3">
                <input
                  autoFocus
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void addNewLabel();
                    }
                  }}
                  placeholder="Label name"
                  maxLength={50}
                  className={`${inputCls} mb-2`}
                />
                <div className="flex items-center gap-1.5">
                  {LABEL_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewLabelColor(c)}
                      className={`w-5 h-5 rounded-full transition ${
                        newLabelColor === c ? "ring-2 ring-offset-1 ring-ink/30" : ""
                      }`}
                      style={{ backgroundColor: c }}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                  <button
                    onClick={() => void addNewLabel()}
                    disabled={!newLabelName.trim() || savingLabel}
                    className="ml-auto text-xs px-3 py-1.5 rounded-lg bg-ink text-white font-medium hover:bg-ink/80 disabled:opacity-40 transition"
                  >
                    {savingLabel ? "Adding…" : "Create & add"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Visibility */}
          <div className="flex items-center justify-between rounded-xl border border-line bg-card px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-ink">Dev only</p>
              <p className="text-[11px] text-muted mt-0.5">Hidden from the public widget.</p>
            </div>
            <button
              onClick={() => void actions.updateItem(item.id, { internal: !item.internal })}
              aria-pressed={item.internal ?? false}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                item.internal ? "bg-violet-600" : "bg-line-strong"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                  item.internal ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
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
                      <span className="text-xs font-semibold text-clay">{c.authorName ?? "You"}</span>
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
                    void postComment();
                  }
                }}
                placeholder="Reply as developer…"
                className={inputCls}
              />
              <button
                onClick={() => void postComment()}
                disabled={posting || !input.trim()}
                className="px-4 py-2 rounded-xl bg-ink text-white text-sm font-medium hover:bg-ink/80 disabled:opacity-40 transition shrink-0"
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
          {confirmDelete ? (
            <span className="flex items-center gap-2">
              <span className="text-xs text-red-500">Delete permanently?</span>
              <button
                onClick={() => void actions.deleteItem(item.id)}
                className="text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition"
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-muted hover:text-ink transition"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-red-400 hover:text-red-600 transition"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
