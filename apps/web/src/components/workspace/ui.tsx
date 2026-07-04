"use client";

import type { FeedbackType } from "@upstep/types";

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
