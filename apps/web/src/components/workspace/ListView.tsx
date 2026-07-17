"use client";

import type { ProjectStatus, WorkspaceItem } from "@/types/dashboard";
import type { WorkspaceActions } from "./ProjectWorkspace";
import { TypePill, StatusMenu, relativeDate } from "./ui";

interface Props {
  items: WorkspaceItem[];
  statuses: ProjectStatus[];
  actions: WorkspaceActions;
}

export function ListView({ items, statuses, actions }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong bg-card/50 text-center py-20 text-muted text-sm">
        No feedback matches these filters.
      </div>
    );
  }

  const firstOpenStatusId = statuses.find((s) => !s.isDone)?.id;

  return (
    <div className="rounded-2xl border border-line bg-card shadow-soft divide-y divide-line">
      {items.map((f) => {
        const isDone = f.boardStatus?.isDone ?? f.status === "DONE";
        return (
          <div
            key={f.id}
            onClick={() => actions.openDetail(f.id)}
            className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface/60 transition first:rounded-t-2xl last:rounded-b-2xl"
          >
            {/* Votes */}
            <div className="flex flex-col items-center justify-center w-10 shrink-0 rounded-lg border border-line bg-surface/60 py-1">
              <span className="text-clay text-[10px] leading-none">▲</span>
              <span className="text-xs font-semibold text-ink leading-tight">{f.upvotes}</span>
            </div>

            {/* Title + meta */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-ink font-medium truncate">{f.title ?? f.content}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-[11px] text-faint">{relativeDate(f.createdAt)}</span>
                {f.labels?.map((l) => (
                  <span
                    key={l.id}
                    className="text-[10px] px-1.5 py-px rounded-full font-medium border"
                    style={{
                      backgroundColor: l.color + "18",
                      color: l.color,
                      borderColor: l.color + "40",
                    }}
                  >
                    {l.name}
                  </span>
                ))}
                {f.internal && (
                  <span className="text-[10px] px-1.5 py-px rounded-full font-semibold border bg-violet-500/10 text-violet-500 border-violet-500/30">
                    Dev only
                  </span>
                )}
                {f.flagged && (
                  <span className="text-[10px] px-1.5 py-px rounded-full font-medium border bg-clay/10 text-clay border-clay/25">
                    ⚑
                  </span>
                )}
              </div>
            </div>

            {/* Type */}
            <TypePill type={f.type} className="hidden sm:inline shrink-0" />

            {/* Status controls - stop row click */}
            <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 shrink-0">
              {isDone && firstOpenStatusId && (
                <button
                  onClick={() => actions.moveItem(f.id, firstOpenStatusId)}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-line text-muted hover:text-clay hover:border-clay/30 transition"
                  title="Move back to an open status"
                >
                  ↺ Reopen
                </button>
              )}
              <StatusMenu
                statuses={statuses}
                value={f.statusId}
                onChange={(id) => actions.moveItem(f.id, id)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
