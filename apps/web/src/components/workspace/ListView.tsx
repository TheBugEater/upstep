"use client";

import type { ProjectStatus, WorkspaceItem } from "@/types/dashboard";
import type { WorkspaceActions } from "./ProjectWorkspace";
import { TypePill, relativeDate } from "./ui";

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

  return (
    <div className="rounded-2xl border border-line bg-card shadow-soft overflow-hidden divide-y divide-line">
      {items.map((f) => (
        <div
          key={f.id}
          onClick={() => actions.openDetail(f.id)}
          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface/60 transition"
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
                <span className="text-[10px] px-1.5 py-px rounded-full font-semibold border bg-violet-50 text-violet-700 border-violet-200">
                  Dev only
                </span>
              )}
              {f.flagged && (
                <span className="text-[10px] px-1.5 py-px rounded-full font-medium border bg-orange-50 text-orange-600 border-orange-100">
                  ⚑
                </span>
              )}
            </div>
          </div>

          {/* Type */}
          <TypePill type={f.type} className="hidden sm:inline shrink-0" />

          {/* Status select — stops row click */}
          <div onClick={(e) => e.stopPropagation()} className="shrink-0">
            <select
              value={f.statusId ?? ""}
              onChange={(e) => {
                if (e.target.value) actions.moveItem(f.id, e.target.value);
              }}
              className="text-xs rounded-lg border border-line bg-card py-1.5 pl-2 pr-6 text-ink focus:outline-none focus:border-clay/40 transition cursor-pointer max-w-[130px]"
              style={{ color: f.boardStatus?.color }}
            >
              {!f.statusId && <option value="">No status</option>}
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}
