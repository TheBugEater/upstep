"use client";

import { useState } from "react";
import type { FeedbackType } from "@upstep/types";
import type { ProjectStatus } from "@/types/dashboard";

export const TYPE_COLORS: Record<FeedbackType, string> = {
  BUG: "bg-danger/10 text-danger border-danger/25",
  FEATURE: "bg-info/10 text-info border-info/25",
  GENERAL: "bg-surface text-muted border-line",
};

export const TYPE_LABELS: Record<FeedbackType, string> = {
  BUG: "Bug",
  FEATURE: "Feature",
  GENERAL: "General",
};

export const TYPES: FeedbackType[] = ["BUG", "FEATURE", "GENERAL"];

export const LABEL_PALETTE = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899",
];

export const STATUS_PALETTE = [
  "#94a3b8", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899", "#22c55e",
];

export function TypePill({ type, className = "" }: { type: FeedbackType; className?: string }) {
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${TYPE_COLORS[type]} ${className}`}>
      {TYPE_LABELS[type]}
    </span>
  );
}

export function StatusDot({ color, className = "" }: { color: string; className?: string }) {
  return (
    <span
      className={`w-2 h-2 rounded-full inline-block shrink-0 ${className}`}
      style={{ backgroundColor: color }}
    />
  );
}

/** Colored status picker: current status as a pill button, opens a small
 *  popover of every status (also colored) to pick from. Used anywhere a
 *  bare native <select> would hide which status is which at a glance. */
export function StatusMenu({
  statuses,
  value,
  onChange,
  className = "",
}: {
  statuses: ProjectStatus[];
  value: string | null | undefined;
  onChange: (id: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = statuses.find((s) => s.id === value);

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-line bg-card hover:border-line-strong transition font-medium text-ink-soft"
      >
        <StatusDot color={current?.color ?? "#94a3b8"} />
        <span className="max-w-[110px] truncate">{current?.name ?? "No status"}</span>
        <span className="text-faint">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-30 min-w-[150px] rounded-xl border border-line bg-card shadow-lift p-1.5">
            {statuses.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  onChange(s.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg hover:bg-surface transition text-left ${
                  s.id === value ? "font-semibold text-ink" : "text-ink-soft"
                }`}
              >
                <StatusDot color={s.color} />
                <span className="flex-1 truncate">{s.name}</span>
                {s.isDone && <span className="text-[9px] text-faint shrink-0">done</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function relativeDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Shared modal shell: dimmed backdrop + centered card. */
export function ModalShell({
  onClose,
  children,
  wide = false,
}: {
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div
        className={`relative bg-canvas rounded-2xl border border-line shadow-lift w-full ${
          wide ? "max-w-lg" : "max-w-sm"
        } p-6 max-h-[90vh] overflow-y-auto animate-card-in`}
      >
        {children}
      </div>
    </div>
  );
}

export const inputCls =
  "w-full text-sm rounded-xl border border-line bg-surface px-3 py-2 text-ink placeholder:text-faint focus:outline-none focus:border-clay/50 transition";

export const btnPrimary =
  "px-4 py-2 rounded-xl bg-primary text-primary-fg text-sm font-medium hover:bg-primary/85 disabled:opacity-40 transition";

export const btnGhost =
  "px-4 py-2 rounded-xl border border-line text-sm text-muted hover:text-ink transition";
