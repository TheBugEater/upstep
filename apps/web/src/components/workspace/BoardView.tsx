"use client";

import { useEffect, useRef, useState } from "react";
import type { ProjectBoard, ProjectStatus, WorkspaceItem } from "@/types/dashboard";
import type { WorkspaceActions } from "./ProjectWorkspace";
import { TypePill, relativeDate } from "./ui";

interface Props {
  board: ProjectBoard | null;
  items: WorkspaceItem[];
  statuses: ProjectStatus[];
  isOwner: boolean;
  actions: WorkspaceActions;
  onEditBoard: () => void;
}

export function BoardView({ board, items, isOwner, actions, onEditBoard }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overColId, setOverColId] = useState<string | null>(null);
  const draggingRef = useRef(false);

  if (!board) {
    return (
      <div className="text-center py-16 text-muted">
        <p className="text-sm">No board configured{isOwner ? " — create one above." : "."}</p>
      </div>
    );
  }

  if (board.columns.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong bg-card/50 text-center py-16">
        <p className="text-sm text-ink font-medium">This board has no columns</p>
        {isOwner && (
          <button onClick={onEditBoard} className="text-xs text-clay hover:text-clay-hover transition mt-2">
            Add columns →
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
      {board.columns.map((col) => {
        const colItems = items.filter((f) => f.statusId === col.statusId);
        const isOver = overColId === col.statusId;
        return (
          <div
            key={col.id}
            onDragOver={(e) => {
              e.preventDefault();
              setOverColId(col.statusId);
            }}
            onDragLeave={() => setOverColId((c) => (c === col.statusId ? null : c))}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId) actions.moveItem(dragId, col.statusId);
              setDragId(null);
              setOverColId(null);
            }}
            className={`flex-shrink-0 w-72 rounded-2xl border transition-colors self-start ${
              isOver ? "border-clay/50 bg-clay-tint/40" : "border-line bg-surface/40"
            }`}
          >
            {/* Column header */}
            <div className="flex items-center gap-2 px-4 h-12 border-b border-line">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: col.status.color }} />
              <span className="text-sm font-semibold text-ink truncate">{col.status.name}</span>
              {col.status.isDone && (
                <span className="text-[9px] font-semibold uppercase tracking-wide text-green-600 bg-green-50 border border-green-100 rounded-full px-1.5 py-px shrink-0">
                  done
                </span>
              )}
              <span className="ml-auto text-xs font-medium text-faint bg-card border border-line rounded-full px-2 py-0.5 shrink-0">
                {colItems.length}
              </span>
              <button
                onClick={() => actions.openQuickAdd(col.statusId)}
                className="text-muted hover:text-clay transition text-base leading-none shrink-0"
                title={`Add task to ${col.status.name}`}
                aria-label={`Add task to ${col.status.name}`}
              >
                +
              </button>
            </div>

            {/* Quick add composer */}
            <ColumnComposer statusId={col.statusId} actions={actions} />

            {/* Cards */}
            <div className="p-2.5 space-y-2.5 min-h-[120px] max-h-[65vh] overflow-y-auto">
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
                    onDragStart={() => {
                      setDragId(f.id);
                      draggingRef.current = true;
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverColId(null);
                      setTimeout(() => {
                        draggingRef.current = false;
                      }, 0);
                    }}
                    onClick={() => {
                      if (!draggingRef.current) actions.openDetail(f.id);
                    }}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Inline per-column composer ───────────────────────────────────────────────
// Press Enter in the column header "+" flow for the fast path; this inline
// composer covers the "type straight into the column" habit from Linear/Trello.

function ColumnComposer({
  statusId,
  actions,
}: {
  statusId: string;
  actions: WorkspaceActions;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function submit() {
    const trimmed = title.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    const ok = await actions.createTask({
      title: trimmed,
      content: trimmed,
      type: "GENERAL",
      statusId,
      labelIds: [],
      internal: false,
    });
    setSaving(false);
    if (ok) setTitle("");
    inputRef.current?.focus();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full text-left text-xs text-faint hover:text-muted px-4 py-2 border-b border-line/60 transition"
      >
        + Add a card…
      </button>
    );
  }

  return (
    <div className="px-2.5 pt-2.5">
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void submit();
          } else if (e.key === "Escape") {
            setOpen(false);
            setTitle("");
          }
        }}
        onBlur={() => {
          if (!title.trim()) setOpen(false);
        }}
        placeholder={saving ? "Adding…" : "Card title — Enter to add"}
        disabled={saving}
        className="w-full text-xs rounded-xl border border-clay/40 bg-card px-3 py-2 text-ink placeholder:text-faint focus:outline-none focus:border-clay/60 transition disabled:opacity-60"
      />
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function BoardCard({
  item,
  isDragging,
  onDragStart,
  onDragEnd,
  onClick,
}: {
  item: WorkspaceItem;
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
        <TypePill type={item.type} />
        {item.internal && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold border bg-violet-50 text-violet-700 border-violet-200">
            Dev
          </span>
        )}
        {item.flagged && (
          <span
            title="Flagged"
            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium border bg-orange-50 text-orange-600 border-orange-100"
          >
            ⚑
          </span>
        )}
        <span className="ml-auto text-[10px] text-faint">{relativeDate(item.createdAt)}</span>
      </div>
    </article>
  );
}
