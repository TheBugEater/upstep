"use client";

import { useState, useRef, useEffect } from "react";
import type { Comment, Feedback, FeedbackType } from "@upstep/types";
import type { ProjectBoard, ProjectStatus } from "@/types/dashboard";

// ─── Local types ──────────────────────────────────────────────────────────────

interface LabelRef { id: string; name: string; color: string; }
interface BoardStatus { id: string; name: string; color: string; order: number; isDone: boolean; }
interface BoardFeedback extends Feedback {
  statusId?: string | null;
  boardStatus?: BoardStatus | null;
  labels?: LabelRef[];
}

const TYPE_COLORS: Record<FeedbackType, string> = {
  BUG: "bg-red-50 text-red-600 border-red-100",
  FEATURE: "bg-blue-50 text-blue-600 border-blue-100",
  GENERAL: "bg-surface text-muted border-line",
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  projectId: string;
  feedback: BoardFeedback[];
  boards: ProjectBoard[];
  statuses: ProjectStatus[];
  projectLabels: LabelRef[];
  isOwner: boolean;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FeedbackBoard({ projectId, feedback, boards, statuses, projectLabels, isOwner }: Props) {
  const [items, setItems] = useState<BoardFeedback[]>(feedback);
  const [boardList, setBoardList] = useState<ProjectBoard[]>(boards);
  const [activeBoardId, setActiveBoardId] = useState<string>(
    boards.find((b) => b.isDefault)?.id ?? boards[0]?.id ?? ""
  );
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overColId, setOverColId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewBoard, setShowNewBoard] = useState(false);
  const [showManageStatuses, setShowManageStatuses] = useState(false);
  const draggingRef = useRef(false);

  const activeBoard = boardList.find((b) => b.id === activeBoardId) ?? boardList[0];
  const selectedItem = items.find((f) => f.id === selectedId) ?? null;

  async function move(id: string, statusId: string) {
    const current = items.find((f) => f.id === id);
    if (!current || current.statusId === statusId) return;

    const targetStatus = statuses.find((s) => s.id === statusId);
    setItems((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, statusId, boardStatus: targetStatus ?? null } : f
      ) as BoardFeedback[]
    );

    const res = await fetch(`/api/projects/${projectId}/feedback/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statusId }),
    });
    if (!res.ok) {
      setItems((prev) => prev.map((f) => (f.id === id ? current : f)));
    }
  }

  function getColItems(statusId: string) {
    return items.filter((f) => {
      if (f.statusId !== statusId) return false;
      if (labelFilter && !f.labels?.some((l) => l.id === labelFilter)) return false;
      return true;
    });
  }

  return (
    <>
      {/* Board selector + manage */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-1 min-w-0 overflow-x-auto scrollbar-none">
          {boardList.map((b) => (
            <button
              key={b.id}
              onClick={() => setActiveBoardId(b.id)}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-full font-medium border transition ${
                b.id === activeBoardId
                  ? "bg-ink text-white border-ink"
                  : "bg-card text-muted border-line hover:border-line-strong hover:text-ink"
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
        {isOwner && (
          <div className="flex items-center gap-2 ml-auto shrink-0">
            <button
              onClick={() => setShowManageStatuses(true)}
              className="text-xs text-muted hover:text-ink transition"
            >
              Manage statuses
            </button>
            <button
              onClick={() => setShowNewBoard(true)}
              className="text-xs px-3 py-1.5 rounded-full font-medium border border-line bg-card text-muted hover:border-clay hover:text-clay transition"
            >
              + New board
            </button>
          </div>
        )}
      </div>

      {/* Label filter */}
      {projectLabels.length > 0 && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-xs text-faint">Filter:</span>
          {projectLabels.map((l) => (
            <button
              key={l.id}
              onClick={() => setLabelFilter((prev) => (prev === l.id ? null : l.id))}
              className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border transition ${
                labelFilter === l.id ? "border-transparent text-white" : "bg-card border-line text-muted hover:border-line-strong"
              }`}
              style={labelFilter === l.id ? { backgroundColor: l.color, borderColor: l.color } : {}}
            >
              <span
                className="w-1.5 h-1.5 rounded-full inline-block"
                style={{ backgroundColor: l.color }}
              />
              {l.name}
            </button>
          ))}
          {labelFilter && (
            <button onClick={() => setLabelFilter(null)} className="text-xs text-faint hover:text-muted transition">
              Clear
            </button>
          )}
        </div>
      )}

      {/* Board columns */}
      {!activeBoard ? (
        <div className="text-center py-16 text-muted">
          <p className="text-sm">No board configured. Create one above.</p>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
          {activeBoard.columns.map((col) => {
            const colItems = getColItems(col.statusId);
            const isOver = overColId === col.statusId;
            return (
              <div
                key={col.id}
                onDragOver={(e) => { e.preventDefault(); setOverColId(col.statusId); }}
                onDragLeave={() => setOverColId((c) => (c === col.statusId ? null : c))}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragId) move(dragId, col.statusId);
                  setDragId(null);
                  setOverColId(null);
                }}
                className={`flex-shrink-0 w-72 rounded-2xl border transition-colors ${
                  isOver ? "border-clay/50 bg-clay-tint/40" : "border-line bg-surface/40"
                }`}
              >
                {/* Column header */}
                <div className="flex items-center gap-2 px-4 h-12 border-b border-line">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: col.status.color }}
                  />
                  <span className="text-sm font-semibold text-ink">{col.status.name}</span>
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
                      <BoardCard
                        key={f.id}
                        item={f}
                        isDragging={dragId === f.id}
                        onDragStart={() => { setDragId(f.id); draggingRef.current = true; }}
                        onDragEnd={() => {
                          setDragId(null);
                          setOverColId(null);
                          setTimeout(() => { draggingRef.current = false; }, 0);
                        }}
                        onClick={() => { if (!draggingRef.current) setSelectedId(f.id); }}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail panel */}
      {selectedItem && (
        <BoardDetail
          key={selectedItem.id}
          item={selectedItem}
          projectId={projectId}
          statuses={statuses}
          projectLabels={projectLabels}
          onClose={() => setSelectedId(null)}
          onStatusChange={(id, statusId) => move(id, statusId)}
          onLabelChange={(id, labels) =>
            setItems((prev) => prev.map((f) => (f.id === id ? { ...f, labels } : f)))
          }
          onDelete={(id) => {
            setItems((prev) => prev.filter((f) => f.id !== id));
            setSelectedId(null);
          }}
        />
      )}

      {/* New board modal */}
      {showNewBoard && (
        <NewBoardModal
          projectId={projectId}
          statuses={statuses}
          onClose={() => setShowNewBoard(false)}
          onCreate={(board) => {
            setBoardList((prev) => [...prev, board]);
            setActiveBoardId(board.id);
            setShowNewBoard(false);
          }}
        />
      )}

      {/* Manage statuses modal */}
      {showManageStatuses && (
        <ManageStatusesModal
          projectId={projectId}
          initialStatuses={statuses}
          onClose={() => setShowManageStatuses(false)}
        />
      )}
    </>
  );
}

// ─── Board card ───────────────────────────────────────────────────────────────

function BoardCard({
  item,
  isDragging,
  onDragStart,
  onDragEnd,
  onClick,
}: {
  item: BoardFeedback;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: () => void;
}) {
  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`group bg-card border border-line rounded-xl p-3 shadow-soft cursor-pointer hover:border-line-strong hover:shadow-md transition ${
        isDragging ? "opacity-50 !cursor-grab" : ""
      }`}
    >
      <p className="text-sm font-semibold text-ink leading-snug line-clamp-2">
        {item.title ?? item.content}
      </p>
      {item.title && (
        <p className="text-xs text-muted mt-1 line-clamp-2 leading-snug">{item.content}</p>
      )}

      {item.labels && item.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {item.labels.map((l) => (
            <span
              key={l.id}
              className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-medium"
              style={{ backgroundColor: l.color }}
            >
              {l.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-2.5">
        <span className="inline-flex items-center gap-1 text-clay text-xs font-semibold">
          <span className="text-[10px]">▲</span>
          {item.upvotes}
        </span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${TYPE_COLORS[item.type]}`}>
          {item.type}
        </span>
        {item.flagged && (
          <span
            title="Flagged"
            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium border bg-orange-50 text-orange-600 border-orange-100"
          >
            ⚑
          </span>
        )}
        <span className="ml-auto text-[10px] text-faint">
          {new Date(item.createdAt).toLocaleDateString()}
        </span>
      </div>
    </article>
  );
}

// ─── Board detail drawer ──────────────────────────────────────────────────────

function BoardDetail({
  item,
  projectId,
  statuses,
  projectLabels,
  onClose,
  onStatusChange,
  onLabelChange,
  onDelete,
}: {
  item: BoardFeedback;
  projectId: string;
  statuses: ProjectStatus[];
  projectLabels: LabelRef[];
  onClose: () => void;
  onStatusChange: (id: string, statusId: string) => void;
  onLabelChange: (id: string, labels: LabelRef[]) => void;
  onDelete: (id: string) => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [input, setInput] = useState("");
  const [posting, setPosting] = useState(false);
  const [localLabels, setLocalLabels] = useState<LabelRef[]>(item.labels ?? []);
  const [currentStatusId, setCurrentStatusId] = useState<string | null>(item.statusId ?? null);

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

  async function toggleLabel(label: LabelRef) {
    const has = localLabels.some((l) => l.id === label.id);
    const next = has ? localLabels.filter((l) => l.id !== label.id) : [...localLabels, label];
    setLocalLabels(next);
    onLabelChange(item.id, next);
    await fetch(`/api/projects/${projectId}/feedback/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(has ? { removeLabelId: label.id } : { addLabelId: label.id }),
    });
  }

  function handleStatusClick(statusId: string) {
    setCurrentStatusId(statusId);
    onStatusChange(item.id, statusId);
  }

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 w-full sm:max-w-md bg-canvas border-l border-line shadow-lift flex flex-col overflow-hidden">
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
              {statuses.map((s) => {
                const isActive = currentStatusId === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => handleStatusClick(s.id)}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium border transition ${
                      isActive ? "text-white border-transparent" : "bg-card border-line text-muted hover:border-line-strong"
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
          {projectLabels.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Labels</p>
              <div className="flex flex-wrap gap-2">
                {projectLabels.map((l) => {
                  const has = localLabels.some((x) => x.id === l.id);
                  return (
                    <button
                      key={l.id}
                      onClick={() => toggleLabel(l)}
                      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border transition ${
                        has ? "text-white border-transparent" : "bg-card border-line text-muted hover:border-line-strong"
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
              </div>
            </div>
          )}

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
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); postComment(); }
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
              month: "long", day: "numeric", year: "numeric",
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

// ─── New board modal ──────────────────────────────────────────────────────────

function NewBoardModal({
  projectId,
  statuses,
  onClose,
  onCreate,
}: {
  projectId: string;
  statuses: ProjectStatus[];
  onClose: () => void;
  onCreate: (board: ProjectBoard) => void;
}) {
  const [name, setName] = useState("");
  const [selectedStatusIds, setSelectedStatusIds] = useState<string[]>(statuses.map((s) => s.id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleStatus(id: string) {
    setSelectedStatusIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function create() {
    if (!name.trim() || selectedStatusIds.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/boards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), columnStatusIds: selectedStatusIds }),
      });
      if (!res.ok) { setError("Failed to create board"); return; }
      const board = (await res.json()) as ProjectBoard;
      onCreate(board);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-canvas rounded-2xl border border-line shadow-lift w-full max-w-sm p-6 space-y-4">
        <h3 className="font-semibold text-ink">New board</h3>

        <div>
          <label className="text-xs font-medium text-muted mb-1 block">Board name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sprint 1"
            className="w-full text-sm rounded-xl border border-line bg-surface px-3 py-2 focus:outline-none focus:border-clay/50 transition"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted mb-2 block">Columns (statuses)</label>
          <div className="space-y-1.5">
            {statuses.map((s) => {
              const checked = selectedStatusIds.includes(s.id);
              return (
                <label key={s.id} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleStatus(s.id)}
                    className="rounded border-line"
                  />
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-sm text-ink">{s.name}</span>
                  {s.isDone && <span className="text-[10px] text-faint ml-auto">done</span>}
                </label>
              );
            })}
          </div>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 text-sm px-4 py-2 rounded-xl border border-line text-muted hover:text-ink transition"
          >
            Cancel
          </button>
          <button
            onClick={create}
            disabled={saving || !name.trim() || selectedStatusIds.length === 0}
            className="flex-1 text-sm px-4 py-2 rounded-xl bg-ink text-white font-medium hover:bg-ink/80 disabled:opacity-40 transition"
          >
            {saving ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Manage statuses modal ────────────────────────────────────────────────────

function ManageStatusesModal({
  projectId,
  initialStatuses,
  onClose,
}: {
  projectId: string;
  initialStatuses: ProjectStatus[];
  onClose: () => void;
}) {
  const [statusList, setStatusList] = useState<ProjectStatus[]>(initialStatuses);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#94a3b8");
  const [newIsDone, setNewIsDone] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addStatus() {
    if (!newName.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/statuses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), color: newColor, isDone: newIsDone }),
      });
      if (!res.ok) { setError("Failed to create status"); return; }
      const s = (await res.json()) as ProjectStatus;
      setStatusList((prev) => [...prev, s]);
      setNewName("");
      setNewColor("#94a3b8");
      setNewIsDone(false);
    } finally {
      setAdding(false);
    }
  }

  async function deleteStatus(id: string) {
    if (!confirm("Delete this status? Cards in this column will become unassigned.")) return;
    const res = await fetch(`/api/projects/${projectId}/statuses/${id}`, { method: "DELETE" });
    if (res.ok) setStatusList((prev) => prev.filter((s) => s.id !== id));
    else setError("Cannot delete the last status");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-canvas rounded-2xl border border-line shadow-lift w-full max-w-sm p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold text-ink">Manage statuses</h3>

        <div className="space-y-2">
          {statusList.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-xl border border-line bg-surface">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-sm text-ink flex-1">{s.name}</span>
              {s.isDone && <span className="text-[10px] text-faint">done</span>}
              <button
                onClick={() => deleteStatus(s.id)}
                className="text-xs text-red-400 hover:text-red-600 transition shrink-0"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="border-t border-line pt-4 space-y-3">
          <p className="text-xs font-medium text-muted">Add new status</p>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Status name"
            className="w-full text-sm rounded-xl border border-line bg-surface px-3 py-2 focus:outline-none focus:border-clay/50 transition"
          />
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted">Color</label>
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border border-line"
            />
            <label className="flex items-center gap-2 text-xs text-muted cursor-pointer ml-auto">
              <input
                type="checkbox"
                checked={newIsDone}
                onChange={(e) => setNewIsDone(e.target.checked)}
                className="rounded border-line"
              />
              Mark as done
            </label>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            onClick={addStatus}
            disabled={adding || !newName.trim()}
            className="w-full text-sm px-4 py-2 rounded-xl bg-ink text-white font-medium hover:bg-ink/80 disabled:opacity-40 transition"
          >
            {adding ? "Adding…" : "Add status"}
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full text-sm px-4 py-2 rounded-xl border border-line text-muted hover:text-ink transition"
        >
          Done
        </button>
      </div>
    </div>
  );
}
