"use client";

import { useEffect, useState } from "react";
import type { Comment, Label } from "@upstep/types";
import type { ProjectStatus, WorkspaceItem } from "@/types/dashboard";
import type { WorkspaceActions, TeamMember } from "./ProjectWorkspace";
import { TYPES, TYPE_COLORS, TYPE_LABELS, LABEL_PALETTE, inputCls } from "./ui";

interface Props {
  item: WorkspaceItem;
  projectId: string;
  statuses: ProjectStatus[];
  projectLabels: Label[];
  actions: WorkspaceActions;
  onClose: () => void;
  teamMembers: TeamMember[];
  currentUserId: string;
}

export function DetailDrawer({ item, projectId, statuses, projectLabels, actions, onClose, teamMembers, currentUserId }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [input, setInput] = useState("");
  const [posting, setPosting] = useState(false);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [commentError, setCommentError] = useState("");
  const [loadingComments, setLoadingComments] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [assignmentError, setAssignmentError] = useState("");
  const [chatSpaces, setChatSpaces] = useState<{ id: string; name: string | null; status: string | null }[]>([]);
  const [chatSpaceId, setChatSpaceId] = useState("");
  const [sharingChat, setSharingChat] = useState(false);
  const [chatNotice, setChatNotice] = useState("");
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState(LABEL_PALETTE[0]!);
  const [showNewLabel, setShowNewLabel] = useState(false);
  const [savingLabel, setSavingLabel] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const itemLabels = item.labels ?? [];

  useEffect(() => {
    const controller = new AbortController();
    async function refreshSpaces() {
      try {
        const res = await fetch(`/api/projects/${projectId}/feedback/${item.id}/google-chat`, { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json() as { spaces: typeof chatSpaces };
        if (controller.signal.aborted) return;
        setChatSpaces(data.spaces);
        setChatSpaceId((previous) => data.spaces.some((s) => s.id === previous) ? previous : data.spaces[0]?.id ?? "");
      } catch { /* The next poll can recover a transient error. */ }
    }
    void refreshSpaces();
    const interval = setInterval(() => void refreshSpaces(), 15_000);
    return () => { controller.abort(); clearInterval(interval); };
  }, [projectId, item.id]);

  async function startChatDiscussion() {
    if (!chatSpaceId || sharingChat) return;
    setSharingChat(true);
    setChatNotice("");
    try {
      const res = await fetch(`/api/projects/${projectId}/feedback/${item.id}/google-chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ integrationId: chatSpaceId }) });
      const data = await res.json() as { error?: string; status?: string };
      if (!res.ok) throw new Error(data.error || "Couldn't start this discussion.");
      setChatSpaces((previous) => previous.map((s) => s.id === chatSpaceId ? { ...s, status: data.status ?? "PENDING" } : s));
      setChatNotice(data.status === "COMPLETED" ? "Discussion already started in Google Chat." : "Discussion queued for Google Chat. Selected task updates will join the same thread.");
    } catch (error) { setChatNotice(error instanceof Error ? error.message : "Couldn't start this discussion."); }
    finally { setSharingChat(false); }
  }

  useEffect(() => {
    const controller = new AbortController();
    async function refreshComments() {
      try {
        const res = await fetch(`/api/projects/${projectId}/feedback/${item.id}/comments`, { signal: controller.signal });
        if (!res.ok) throw new Error("Couldn't load comments.");
        const incoming = await res.json() as Comment[];
        if (controller.signal.aborted) return;
        setComments((previous) => [...new Map([...previous, ...incoming].map((c) => [c.id, c])).values()].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
        setCommentError("");
      } catch {
        if (!controller.signal.aborted) setCommentError("Couldn't load comments. Retrying shortly.");
      } finally {
        if (!controller.signal.aborted) setLoadingComments(false);
      }
    }
    void refreshComments();
    const interval = setInterval(() => void refreshComments(), 15_000);
    window.addEventListener("focus", refreshComments);
    return () => { controller.abort(); clearInterval(interval); window.removeEventListener("focus", refreshComments); };
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
    setCommentError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/feedback/${item.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: input.trim(), ...(replyTo ? { parentId: replyTo.id } : {}) }),
      });
      if (res.ok) {
        const c = (await res.json()) as Comment;
        setComments((prev) => [...prev.filter((existing) => existing.id !== c.id), c]);
        setInput("");
        setReplyTo(null);
      } else setCommentError("Couldn't post this comment. Please try again.");
    } catch {
      setCommentError("Couldn't post this comment. Please try again.");
    } finally {
      setPosting(false);
    }
  }

  async function assignTask(assigneeId: string | null) {
    setAssigning(true);
    setAssignmentError("");
    try {
      if (!await actions.updateItem(item.id, { assigneeId })) setAssignmentError("Couldn't assign this task. Check that the teammate still has access.");
    } catch { setAssignmentError("Couldn't assign this task. Please try again."); }
    finally { setAssigning(false); }
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
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 w-full sm:max-w-md bg-canvas border-l border-line shadow-lift flex flex-col overflow-hidden animate-[drawer-in_0.35s_cubic-bezier(0.32,0.72,0,1)_both]">
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

          <div>
            <label htmlFor="task-assignee" className="block text-xs font-semibold text-muted uppercase tracking-wide mb-2">Assignee</label>
            <div className="flex items-center gap-2">
              <select id="task-assignee" value={item.assigneeId ?? ""} disabled={assigning} onChange={(e) => void assignTask(e.target.value || null)} className={inputCls}>
                <option value="">Unassigned</option>
                {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.name || m.email}{m.id === currentUserId ? " (you)" : ""}</option>)}
              </select>
              {item.assigneeId !== currentUserId && <button type="button" disabled={assigning} onClick={() => void assignTask(currentUserId)} className="shrink-0 text-xs text-clay hover:underline disabled:opacity-40">Assign to me</button>}
            </div>
            {assignmentError && <p role="alert" className="mt-2 text-xs text-danger">{assignmentError}</p>}
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
                    className="ml-auto text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-fg font-medium hover:bg-primary/85 disabled:opacity-40 transition"
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

          {chatSpaces.length > 0 && <div className="rounded-xl border border-line bg-card p-4 space-y-2">
            <p className="text-xs font-semibold text-ink">Discuss in Google Chat</p>
            {chatSpaces.length > 1 && <select aria-label="Google Chat space" value={chatSpaceId} onChange={(e) => setChatSpaceId(e.target.value)} className={inputCls}>{chatSpaces.map((s, i) => <option key={s.id} value={s.id}>{s.name || `Google Chat space ${i + 1}`}</option>)}</select>}
            <p className="text-xs text-muted">Start a thread for this task in {chatSpaces.find((s) => s.id === chatSpaceId)?.name || "your connected space"}. Teammates can reply there.</p>
            <button type="button" disabled={sharingChat || ["PENDING", "PROCESSING", "COMPLETED"].includes(chatSpaces.find((s) => s.id === chatSpaceId)?.status ?? "")} onClick={() => void startChatDiscussion()} className="text-xs font-semibold text-clay hover:underline disabled:text-muted disabled:no-underline">
              {sharingChat ? "Starting…" : chatSpaces.find((s) => s.id === chatSpaceId)?.status === "COMPLETED" ? "Discussion started" : ["PENDING", "PROCESSING"].includes(chatSpaces.find((s) => s.id === chatSpaceId)?.status ?? "") ? "Discussion queued" : chatSpaces.find((s) => s.id === chatSpaceId)?.status === "FAILED" ? "Retry discussion" : "Start Google Chat discussion"}
            </button>
            {chatNotice && <p role="status" className="text-xs text-muted">{chatNotice}</p>}
          </div>}

          {/* Comments */}
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">
              Comments · {comments.length}
            </p>
            {comments.length === 0 ? (
              <p className="text-xs text-faint mb-3">{loadingComments ? "Loading comments…" : "Start a conversation about this task."}</p>
            ) : (
              <div className="space-y-2 mb-3">
                {comments.map((c) => {
                  const parent = comments.find((p) => p.id === c.parentId);
                  const authorName = c.author?.name?.trim() || c.authorName?.trim() || "UpStep Team";
                  return <div key={c.id} className={`bg-surface rounded-xl border border-line p-3 ${c.parentId ? "ml-4 border-l-2" : ""}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span aria-hidden="true" className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-clay/10 text-clay text-[10px] font-semibold">{authorName[0]?.toUpperCase()}</span>
                      <span className="text-xs font-semibold text-ink">{authorName}</span>
                      <time dateTime={c.createdAt} title={new Date(c.createdAt).toLocaleString()} className="ml-auto text-[10px] text-faint">{new Date(c.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time>
                    </div>
                    {parent && <p className="mb-2 border-l-2 border-line-strong pl-2 text-[11px] text-muted line-clamp-2">Reply to {parent.author?.name || parent.authorName || "UpStep Team"}: {parent.content}</p>}
                    <p className="text-sm text-ink-soft whitespace-pre-wrap break-words">{c.content}</p>
                    <button type="button" onClick={() => setReplyTo(c)} className="mt-2 text-[11px] text-muted hover:text-ink" aria-label={`Reply to ${authorName}`}>Reply</button>
                  </div>
                })}
              </div>
            )}
            {replyTo && <div className="mb-2 flex items-center gap-2 text-xs text-muted"><span className="flex-1 truncate">Replying to {replyTo.author?.name || replyTo.authorName || "UpStep Team"}</span><button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply">✕</button></div>}
            {commentError && <p role="alert" className="mb-2 text-xs text-danger">{commentError}</p>}
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                rows={3}
                maxLength={2000}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void postComment();
                  }
                }}
                placeholder="Write a comment…"
                aria-label="Comment"
                className={inputCls}
              />
              <button
                onClick={() => void postComment()}
                disabled={posting || !input.trim()}
                className="px-4 py-2 rounded-xl bg-primary text-primary-fg text-sm font-medium hover:bg-primary/85 disabled:opacity-40 transition shrink-0"
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
              <span className="text-xs text-danger">Delete permanently?</span>
              <button
                onClick={() => void actions.deleteItem(item.id)}
                className="text-xs px-3 py-1.5 rounded-lg bg-danger text-white font-semibold hover:bg-danger/85 transition"
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
              className="text-xs text-danger hover:text-danger transition"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
