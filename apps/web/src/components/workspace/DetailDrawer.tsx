"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Comment, Label } from "@upstep/types";
import type { ProjectStatus, WorkspaceItem } from "@/types/dashboard";
import type { WorkspaceActions, TeamMember } from "./ProjectWorkspace";
import { TYPES, TYPE_LABELS, LABEL_PALETTE, StatusMenu, inputCls } from "./ui";
import { Avatar } from "@/components/Avatar";

interface Props {
  item: WorkspaceItem;
  projectId: string;
  statuses: ProjectStatus[];
  projectLabels: Label[];
  actions: WorkspaceActions;
  onClose: () => void;
  teamMembers: TeamMember[];
  currentUserId: string;
  /** "modal" opens over the board and keeps its height to the window, so only
   *  the comments scroll. "page" is the task's own page and scrolls as a whole. */
  variant?: "modal" | "page";
}

export function DetailDrawer({ item, projectId, statuses, projectLabels, actions, onClose, teamMembers, currentUserId, variant = "modal" }: Props) {
  const isPage = variant === "page";
  const commentsEnd = useRef<HTMLDivElement>(null);
  const pageHref = `/dashboard/projects/${projectId}/tasks/${item.id}`;
  const [comments, setComments] = useState<Comment[]>([]);
  const [input, setInput] = useState("");
  const [posting, setPosting] = useState(false);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [commentError, setCommentError] = useState("");
  const [loadingComments, setLoadingComments] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [assignmentError, setAssignmentError] = useState("");
  const [chatSpaces, setChatSpaces] = useState<{ id: string; name: string | null; status: string | null; lastError: string | null; availableAt: string | null; threadUrl: string | null }[]>([]);
  const [chatSpaceId, setChatSpaceId] = useState("");
  const [sharingChat, setSharingChat] = useState(false);
  const [chatNotice, setChatNotice] = useState("");
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState(LABEL_PALETTE[0]!);
  const [showNewLabel, setShowNewLabel] = useState(false);
  const [savingLabel, setSavingLabel] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [copied, setCopied] = useState(false);

  const itemLabels = item.labels ?? [];
  const selectedChatSpace = chatSpaces.find((s) => s.id === chatSpaceId);

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
      setChatSpaces((previous) => previous.map((s) => s.id === chatSpaceId ? { ...s, status: data.status ?? "PENDING", lastError: null, availableAt: null } : s));
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
    if (isPage) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, isPage]);

  // In the modal the newest comment sits at the bottom of a scrolling list;
  // keep it in view when comments load or one is posted.
  useEffect(() => {
    // Only on wide screens, where the comment list is its own scroller; on a
    // phone the whole sheet scrolls and jumping would hide the title.
    if (!isPage && window.matchMedia("(min-width: 1024px)").matches) commentsEnd.current?.scrollIntoView({ block: "end" });
  }, [comments.length, isPage]);

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

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${pageHref}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* Clipboard access can be blocked; the URL bar still has the link. */ }
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

  const heading = item.title?.trim() || item.content;
  const pad = isPage ? "" : "px-5 sm:px-7";

  const assignee = teamMembers.find((m) => m.id === item.assigneeId);
  // Prefer the live teammate picture; fall back to the one loaded with the comment.
  const avatarFor = (c: Comment) => {
    const member = teamMembers.find((m) => m.id === (c.author?.id ?? c.authorId));
    return member ? member.image : c.author?.image ?? null;
  };

  const panel = (
      <div className={isPage ? "mx-auto flex w-full max-w-[1160px] flex-col" : "relative flex h-full w-full max-w-[1040px] flex-col overflow-hidden border-line bg-card shadow-lift animate-card-in sm:h-[min(860px,calc(100dvh-48px))] sm:rounded-2xl sm:border"}>
        {/* Header */}
        <div className={isPage ? "flex min-h-14 flex-wrap items-center gap-2 border-b border-line pb-3" : "flex h-14 shrink-0 items-center gap-2 border-b border-line pl-5 pr-3 sm:pl-6"}>
          <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-2 text-xs text-faint">
            {isPage
              ? <Link href={`/dashboard/projects/${projectId}?tab=feedback`} className="inline-flex shrink-0 items-center gap-1 font-medium text-muted hover:text-ink"><span aria-hidden>←</span> Board</Link>
              : <button type="button" onClick={onClose} className="shrink-0 hover:text-ink">Board</button>}
            <span aria-hidden>/</span>
            <span className="truncate font-medium text-ink-soft">{heading}</span>
          </nav>
          <button type="button" onClick={() => void copyLink()} className="hidden h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-medium text-muted transition hover:border-line-strong hover:text-ink sm:inline-flex">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>
            {copied ? "Copied" : "Copy link"}
          </button>
          {!isPage && (
            <Link href={pageHref} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-raised px-3 text-xs font-semibold text-ink transition hover:border-line-strong" title="Open this task on its own page">
              <span className="hidden sm:inline">Open full page</span>
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 4h6v6M20 4l-8 8M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" /></svg>
              <span className="sr-only sm:hidden">Open full page</span>
            </Link>
          )}
          <div className="relative">
            <button type="button" onClick={() => { setShowMenu((v) => !v); setConfirmDelete(false); }} aria-expanded={showMenu} aria-label="More actions" className="grid h-10 w-10 place-items-center rounded-lg text-muted transition hover:bg-raised hover:text-ink">
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg>
            </button>
            {showMenu && <>
              <button className="fixed inset-0 z-10 cursor-default" onClick={() => setShowMenu(false)} aria-label="Close menu" />
              <div className="absolute right-0 top-11 z-20 w-64 rounded-xl border border-line bg-card p-1.5 shadow-lift">
                <button type="button" onClick={() => void copyLink()} className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-xs text-muted hover:bg-raised hover:text-ink sm:hidden">{copied ? "Copied" : "Copy link"}</button>
                <button type="button" onClick={() => void actions.updateItem(item.id, { internal: !item.internal })} aria-pressed={item.internal ?? false} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-raised">
                  <span className="min-w-0 flex-1"><span className="block text-xs font-medium text-ink">Dev only</span><span className="block text-[11px] text-faint">Hide from the public widget</span></span>
                  <span className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${item.internal ? "bg-violet-600" : "bg-line-strong"}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${item.internal ? "translate-x-[18px]" : "translate-x-0.5"}`} /></span>
                </button>
                <div className="my-1 h-px bg-line" />
                {confirmDelete ? (
                  <div className="flex items-center gap-2 px-2.5 py-2">
                    <span className="flex-1 text-xs text-danger">Delete permanently?</span>
                    <button type="button" onClick={() => void actions.deleteItem(item.id).then(() => { if (isPage) onClose(); })} className="rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-danger/85">Delete</button>
                    <button type="button" onClick={() => setConfirmDelete(false)} className="text-xs text-muted hover:text-ink">Cancel</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirmDelete(true)} className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-xs font-medium text-danger hover:bg-danger/10">Delete task…</button>
                )}
              </div>
            </>}
          </div>
          {!isPage && <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-lg text-muted transition hover:bg-raised hover:text-ink" aria-label="Close">
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>}
        </div>

        <div className={isPage ? "flex flex-col gap-8 pt-8 lg:flex-row lg:items-start" : "flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden"}>
          {/* Main column */}
          <div className={isPage ? "min-w-0 flex-1 space-y-8" : "flex min-w-0 flex-1 flex-col lg:min-h-0"}>
            <div className={isPage ? "space-y-4" : `shrink-0 space-y-3 pb-5 pt-5 sm:pt-6 lg:max-h-[40%] lg:overflow-y-auto ${pad}`}>
              {isPage
                ? <h1 id="task-detail-title" className="text-[30px] font-bold leading-tight tracking-[-0.025em] text-ink">{heading}</h1>
                : <h2 id="task-detail-title" className="text-[22px] font-bold leading-snug tracking-[-0.02em] text-ink">{heading}</h2>}
              {item.title?.trim() && <p className={`whitespace-pre-wrap leading-relaxed text-ink-soft ${isPage ? "text-[15px]" : "text-sm"}`}>{item.content}</p>}
            </div>

            {/* Comments */}
            <section aria-labelledby="task-comments-heading" className={isPage ? "" : "flex flex-col lg:min-h-0 lg:flex-1"}>
              <div className={isPage ? "mb-3 flex items-center gap-2 border-b border-line pb-2" : `flex h-11 shrink-0 items-center gap-2 border-y border-line ${pad}`}>
                <h3 id="task-comments-heading" className={`font-semibold text-ink ${isPage ? "text-base" : "text-[13px]"}`}>Comments</h3>
                <span className="text-xs text-faint">{comments.length}</span>
              </div>
              <div className={isPage ? "" : `py-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto ${pad}`}>
              {comments.length === 0 ? (
                <p className="mb-3 text-xs text-faint">{loadingComments ? "Loading comments…" : "Start a conversation about this task."}</p>
              ) : (
                <div className="mb-4 space-y-1">
                  {comments.map((c) => {
                    const parent = comments.find((p) => p.id === c.parentId);
                    const authorName = c.author?.name?.trim() || c.authorName?.trim() || "UpStep Team";
                    return <div key={c.id} className={`-mx-2.5 flex gap-3 rounded-xl px-2.5 py-2.5 transition hover:bg-raised/60 ${c.parentId ? "ml-6" : ""}`}>
                      <Avatar name={authorName} src={avatarFor(c)} size={28} decorative className="mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-baseline gap-2">
                          <span className="text-xs font-semibold text-ink">{authorName}</span>
                          <time dateTime={c.createdAt} title={new Date(c.createdAt).toLocaleString()} className="text-[11px] text-faint">{new Date(c.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time>
                          <button type="button" onClick={() => setReplyTo(c)} className="ml-auto text-[11px] text-muted hover:text-ink" aria-label={`Reply to ${authorName}`}>Reply</button>
                        </div>
                        {parent && <p className="mb-2 line-clamp-2 border-l-2 border-line-strong pl-2 text-[11px] text-muted">Reply to {parent.author?.name || parent.authorName || "UpStep Team"}: {parent.content}</p>}
                        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-soft">{c.content}</p>
                      </div>
                    </div>
                  })}
                </div>
              )}
              <div ref={commentsEnd} />
              </div>
              <div className={isPage ? "" : `shrink-0 border-t border-line pb-4 pt-3 ${pad}`}>
              {commentError && <p role="alert" className="mb-2 text-xs text-danger">{commentError}</p>}
              <div className="rounded-xl border border-line-strong bg-canvas focus-within:border-ink/40 focus-within:ring-4 focus-within:ring-ink/5">
                {replyTo && <div className="flex items-center gap-2 border-b border-line px-3 py-1.5 text-xs text-muted"><span className="flex-1 truncate">Replying to {replyTo.author?.name || replyTo.authorName || "UpStep Team"}</span><button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply">✕</button></div>}
                <textarea
                  value={input}
                  rows={2}
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
                  className="block w-full resize-none bg-transparent px-3.5 py-3 text-sm text-ink placeholder:text-faint focus:outline-none"
                />
                <div className="flex items-center gap-2 px-3 pb-2.5">
                  <span className="hidden text-[11px] text-faint sm:inline">⌘ Enter to post</span>
                  <button
                    onClick={() => void postComment()}
                    disabled={posting || !input.trim()}
                    className="ml-auto rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-fg transition hover:bg-primary/85 disabled:opacity-40"
                  >
                    {posting ? "Posting…" : "Comment"}
                  </button>
                </div>
              </div>
              </div>
            </section>
          </div>

          {/* Properties */}
          <aside className={isPage ? "w-full shrink-0 space-y-5 rounded-2xl border border-line bg-surface p-5 lg:w-[320px]" : "shrink-0 space-y-5 border-t border-line bg-surface p-5 lg:w-[320px] lg:overflow-y-auto lg:border-l lg:border-t-0"}>
            <dl className="grid grid-cols-[84px_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 text-xs">
              <dt className="text-faint">Status</dt>
              <dd><StatusMenu statuses={statuses} value={item.statusId} onChange={(id) => actions.moveItem(item.id, id)} className="[&>div:last-child]:left-0 [&>div:last-child]:right-auto" /></dd>

              <dt><label htmlFor="task-assignee" className="text-faint">Assignee</label></dt>
              <dd className="flex min-w-0 items-center gap-2">
                {assignee ? <Avatar name={assignee.name} email={assignee.email} src={assignee.image} size={24} decorative /> : <span aria-hidden="true" className="h-6 w-6 shrink-0 rounded-full border border-dashed border-line-strong" />}
                <select id="task-assignee" value={item.assigneeId ?? ""} disabled={assigning} onChange={(e) => void assignTask(e.target.value || null)} className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-card px-2 text-xs text-ink focus:border-clay/50 focus:outline-none">
                  <option value="">Unassigned</option>
                  {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.name || m.email}{m.id === currentUserId ? " (you)" : ""}</option>)}
                </select>
                {item.assigneeId !== currentUserId && <button type="button" disabled={assigning} onClick={() => void assignTask(currentUserId)} className="shrink-0 text-[11px] font-medium text-clay hover:underline disabled:opacity-40">Me</button>}
              </dd>
              {assignmentError && <dd role="alert" className="col-span-2 text-danger">{assignmentError}</dd>}

              <dt><label htmlFor="task-type" className="text-faint">Type</label></dt>
              <dd>
                <select id="task-type" value={item.type} onChange={(e) => void actions.updateItem(item.id, { type: e.target.value as typeof item.type })} className="h-8 rounded-lg border border-line bg-card px-2 text-xs text-ink focus:border-clay/50 focus:outline-none">
                  {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                </select>
              </dd>

              <dt className="self-start pt-1.5 text-faint">Labels</dt>
              <dd className="relative flex flex-wrap items-center gap-1.5">
                {itemLabels.map((l) => (
                  <span key={l.id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card py-0.5 pl-2 pr-1 text-[11px] text-ink-soft">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: l.color }} />{l.name}
                    <button type="button" onClick={() => void actions.toggleItemLabel(item.id, l, true)} className="grid h-4 w-4 place-items-center rounded-full text-faint hover:text-ink" aria-label={`Remove ${l.name}`}>×</button>
                  </span>
                ))}
                <button type="button" onClick={() => setShowLabelPicker((v) => !v)} aria-expanded={showLabelPicker} className="rounded-full border border-dashed border-line-strong px-2 py-0.5 text-[11px] text-faint transition hover:text-ink">+ Add</button>
                {showLabelPicker && <>
                  <button className="fixed inset-0 z-10 cursor-default" onClick={() => { setShowLabelPicker(false); setShowNewLabel(false); }} aria-label="Close labels" />
                  <div className="absolute left-0 top-full z-20 mt-1 w-60 rounded-xl border border-line bg-card p-1.5 shadow-lift">
                    <div className="max-h-56 overflow-y-auto">
                      {projectLabels.map((l) => {
                        const has = itemLabels.some((x) => x.id === l.id);
                        return <button key={l.id} type="button" onClick={() => void actions.toggleItemLabel(item.id, l, has)} aria-pressed={has} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-ink-soft hover:bg-raised">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
                          <span className="flex-1 truncate">{l.name}</span>
                          {has && <span className="text-clay" aria-hidden>✓</span>}
                        </button>;
                      })}
                    </div>
                    {showNewLabel ? (
                      <div className="mt-1 border-t border-line p-1.5 pt-2.5">
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
                          aria-label="New label name"
                          maxLength={50}
                          className={`${inputCls} mb-2 !py-1.5 !text-xs`}
                        />
                        <div className="flex items-center gap-1">
                          {LABEL_PALETTE.map((c) => (
                            <button key={c} type="button" onClick={() => setNewLabelColor(c)} className={`h-5 w-5 rounded-full transition ${newLabelColor === c ? "ring-2 ring-ink/40 ring-offset-1 ring-offset-card" : ""}`} style={{ backgroundColor: c }} aria-label={`Color ${c}`} />
                          ))}
                        </div>
                        <button onClick={() => void addNewLabel()} disabled={!newLabelName.trim() || savingLabel} className="mt-2 w-full rounded-lg bg-primary py-1.5 text-xs font-semibold text-primary-fg transition hover:bg-primary/85 disabled:opacity-40">
                          {savingLabel ? "Adding…" : "Create & add"}
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setShowNewLabel(true)} className="mt-1 flex w-full items-center rounded-lg border-t border-line px-2.5 py-2 text-left text-xs text-muted hover:bg-raised hover:text-ink">+ New label</button>
                    )}
                  </div>
                </>}
              </dd>

              <dt className="text-faint">Votes</dt>
              <dd className="flex items-center gap-3">
                <span className="font-semibold text-clay">▲ {item.upvotes}</span>
                {(item.downvotes ?? 0) > 0 && <span className="text-muted">▼ {item.downvotes}</span>}
              </dd>

              <dt className="text-faint">Visibility</dt>
              <dd className="text-ink-soft">{item.internal ? "Dev only" : "Public"}</dd>

              <dt className="text-faint">Created</dt>
              <dd className="text-ink-soft" suppressHydrationWarning>{new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</dd>
            </dl>

            {chatSpaces.length > 0 && <section aria-labelledby="gchat-heading" className={`space-y-2.5 rounded-xl border p-4 ${selectedChatSpace?.threadUrl ? "border-success/30 bg-success/10" : "border-line bg-card"}`}>
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className={`h-4 w-4 ${selectedChatSpace?.threadUrl ? "text-success" : "text-faint"}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 5h16v11H9l-5 4z" /></svg>
                <h3 id="gchat-heading" className="text-xs font-semibold text-ink">Google Chat</h3>
              </div>
              {chatSpaces.length > 1 && <select aria-label="Google Chat space" value={chatSpaceId} onChange={(e) => setChatSpaceId(e.target.value)} className={`${inputCls} !py-1.5 !text-xs`}>{chatSpaces.map((s, i) => <option key={s.id} value={s.id}>{s.name || `Google Chat space ${i + 1}`}</option>)}</select>}
              {selectedChatSpace?.threadUrl ? <>
                <p className="text-xs leading-5 text-muted">This task has a thread in <span className="font-medium text-ink-soft">{selectedChatSpace.name || "your connected space"}</span>. Task updates post there too.</p>
                <a href={selectedChatSpace.threadUrl} target="_blank" rel="noopener noreferrer" className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-success/15 text-xs font-semibold text-ink transition hover:bg-success/25">Open in Google Chat <span aria-hidden="true">↗</span></a>
              </> : <>
                <p className="text-xs leading-5 text-muted">Start a thread for this task in <span className="font-medium text-ink-soft">{selectedChatSpace?.name || "your connected space"}</span>. Teammates can reply there.</p>
                <button type="button" disabled={sharingChat || ["PENDING", "PROCESSING", "COMPLETED"].includes(selectedChatSpace?.status ?? "")} onClick={() => void startChatDiscussion()} className="flex h-9 w-full items-center justify-center rounded-lg border border-line-strong text-xs font-semibold text-ink transition hover:bg-raised disabled:border-line disabled:text-muted disabled:hover:bg-transparent">
                  {sharingChat ? "Starting…" : selectedChatSpace?.status === "COMPLETED" ? "Discussion started" : selectedChatSpace?.status === "PROCESSING" ? "Sending to Google Chat…" : selectedChatSpace?.status === "PENDING" ? selectedChatSpace.lastError ? "Retry scheduled" : "Discussion queued" : selectedChatSpace?.status === "FAILED" ? "Retry discussion" : "Start in Google Chat"}
                </button>
                {selectedChatSpace?.status === "COMPLETED" ? <p role="status" className="text-[11px] leading-4 text-muted">Discussion created in Google Chat. Its link appears here the next time UpStep posts to the thread.</p>
                  : selectedChatSpace?.lastError ? <p role="alert" className="text-[11px] leading-4 text-danger">{selectedChatSpace.lastError}{selectedChatSpace.status === "PENDING" && selectedChatSpace.availableAt ? ` Next retry: ${new Date(selectedChatSpace.availableAt).toLocaleTimeString()}.` : " Check the Google Chat connection, then retry."}</p>
                  : chatNotice && <p role="status" className="text-[11px] leading-4 text-muted">{chatNotice}</p>}
              </>}
            </section>}
          </aside>
        </div>
      </div>
  );

  if (isPage) return <article aria-labelledby="task-detail-title">{panel}</article>;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="task-detail-title">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      {panel}
    </div>
  );
}
