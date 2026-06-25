"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import type { Comment, Feedback, FeedbackStatus, FeedbackType, Label } from "@upstep/types";

const TYPE_COLORS: Record<FeedbackType, string> = {
  BUG: "bg-red-50 text-red-600 border-red-100",
  FEATURE: "bg-blue-50 text-blue-600 border-blue-100",
  GENERAL: "bg-surface text-muted border-line",
};

const STATUS_COLORS: Record<FeedbackStatus, string> = {
  PENDING: "bg-orange-50 text-orange-600 border-orange-100",
  OPEN: "bg-amber-50 text-amber-700 border-amber-100",
  IN_PROGRESS: "bg-blue-50 text-blue-600 border-blue-100",
  DONE: "bg-green-50 text-green-700 border-green-100",
  CLOSED: "bg-surface text-muted border-line",
};

const LABEL_PALETTE = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899",
];

interface Props {
  projectId: string;
  feedback: Feedback[];
  showStatusFilter?: boolean;
  lead?: React.ReactNode;
}

type SortMode = "newest" | "votes";

const TYPES: FeedbackType[] = ["BUG", "FEATURE", "GENERAL"];
const ACTIVE_STATUSES: FeedbackStatus[] = ["OPEN", "IN_PROGRESS"];

export function FeedbackTable({ projectId, feedback, showStatusFilter = true, lead }: Props) {
  const [items, setItems] = useState(feedback);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [filterType, setFilterType] = useState<FeedbackType | "ALL">("ALL");
  const [filterStatus, setFilterStatus] = useState<FeedbackStatus | "ALL">("ALL");
  const [filterLabelId, setFilterLabelId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortMode>("newest");

  const [commentsByFid, setCommentsByFid] = useState<Record<string, Comment[]>>({});
  const [inputByFid, setInputByFid] = useState<Record<string, string>>({});
  const [postingFid, setPostingFid] = useState<string | null>(null);

  // Label state
  const [projectLabels, setProjectLabels] = useState<Label[]>([]);
  const [labelPickerFid, setLabelPickerFid] = useState<string | null>(null);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState(LABEL_PALETTE[0]!);
  const [savingLabel, setSavingLabel] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Add-task form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addContent, setAddContent] = useState("");
  const [addType, setAddType] = useState<FeedbackType>("FEATURE");
  const [addStatus, setAddStatus] = useState<FeedbackStatus>("OPEN");
  const [addInternal, setAddInternal] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setItems(feedback);
    setExpanded(null);
  }, [feedback]);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/labels`)
      .then((r) => r.json())
      .then((d) => setProjectLabels((d as { labels: Label[] }).labels ?? []))
      .catch(() => {});
  }, [projectId]);

  // Close label picker on outside click
  useEffect(() => {
    if (!labelPickerFid) return;
    function handler(e: MouseEvent) {
      if (!pickerRef.current?.contains(e.target as Node)) {
        setLabelPickerFid(null);
        setNewLabelName("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [labelPickerFid]);

  const displayedItems = useMemo(() => {
    let result = items;
    if (filterType !== "ALL") result = result.filter((f) => f.type === filterType);
    if (filterStatus !== "ALL") result = result.filter((f) => f.status === filterStatus);
    if (filterLabelId) result = result.filter((f) => f.labels?.some((l) => l.id === filterLabelId));
    return sortBy === "votes"
      ? [...result].sort((a, b) => b.upvotes - a.upvotes)
      : [...result].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [items, filterType, filterStatus, sortBy, filterLabelId]);

  const openCount = useMemo(() => items.filter((f) => f.status === "OPEN").length, [items]);
  const inProgressCount = useMemo(() => items.filter((f) => f.status === "IN_PROGRESS").length, [items]);

  async function toggleExpanded(id: string) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!commentsByFid[id]) {
      try {
        const res = await fetch(`/api/projects/${projectId}/feedback/${id}/comments`);
        if (res.ok) {
          const data = (await res.json()) as Comment[];
          setCommentsByFid((prev) => ({ ...prev, [id]: data }));
        }
      } catch { /* non-critical */ }
    }
  }

  async function updateStatus(id: string, status: FeedbackStatus) {
    const res = await fetch(`/api/projects/${projectId}/feedback/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated = (await res.json()) as Feedback;
      setItems((prev) => prev.map((f) => (f.id === id ? updated : f)));
    }
  }

  async function deleteFeedback(id: string) {
    if (!confirm("Delete this feedback item?")) return;
    const res = await fetch(`/api/projects/${projectId}/feedback/${id}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => prev.filter((f) => f.id !== id));
  }

  async function toggleInternal(id: string, current: boolean) {
    const res = await fetch(`/api/projects/${projectId}/feedback/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ internal: !current }),
    });
    if (res.ok) {
      const updated = (await res.json()) as Feedback;
      setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
    }
  }

  async function toggleLabel(fid: string, labelId: string, hasLabel: boolean) {
    setSavingLabel(true);
    const res = await fetch(`/api/projects/${projectId}/feedback/${fid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(hasLabel ? { removeLabelId: labelId } : { addLabelId: labelId }),
    });
    if (res.ok) {
      const updated = (await res.json()) as Feedback;
      setItems((prev) => prev.map((i) => (i.id === fid ? updated : i)));
    }
    setSavingLabel(false);
  }

  async function createLabel(fid: string) {
    const name = newLabelName.trim();
    if (!name || savingLabel) return;
    setSavingLabel(true);
    try {
      const r1 = await fetch(`/api/projects/${projectId}/labels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color: newLabelColor }),
      });
      if (!r1.ok) return;
      const label = (await r1.json()) as Label;
      setProjectLabels((prev) =>
        prev.some((l) => l.id === label.id) ? prev : [...prev, label]
      );
      const r2 = await fetch(`/api/projects/${projectId}/feedback/${fid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addLabelId: label.id }),
      });
      if (r2.ok) {
        const updated = (await r2.json()) as Feedback;
        setItems((prev) => prev.map((i) => (i.id === fid ? updated : i)));
      }
      setNewLabelName("");
      setNewLabelColor(LABEL_PALETTE[0]!);
    } finally {
      setSavingLabel(false);
    }
  }

  function openAddForm() {
    setAddTitle("");
    setAddContent("");
    setAddType("FEATURE");
    setAddStatus("OPEN");
    setAddInternal(false);
    setShowAddForm(true);
    setTimeout(() => titleRef.current?.focus(), 0);
  }

  async function submitAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!addTitle.trim() || addSaving) return;
    setAddSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: addTitle.trim(),
          content: addContent.trim() || addTitle.trim(),
          type: addType,
          status: addStatus,
          internal: addInternal,
        }),
      });
      if (res.ok) {
        const created = (await res.json()) as Feedback;
        setItems((prev) => [created, ...prev]);
        setShowAddForm(false);
      }
    } finally {
      setAddSaving(false);
    }
  }

  async function postComment(id: string) {
    const content = inputByFid[id]?.trim();
    if (!content || postingFid === id) return;
    setPostingFid(id);
    try {
      const res = await fetch(`/api/projects/${projectId}/feedback/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const comment = (await res.json()) as Comment;
        setCommentsByFid((prev) => ({ ...prev, [id]: [...(prev[id] ?? []), comment] }));
        setInputByFid((prev) => ({ ...prev, [id]: "" }));
      }
    } finally {
      setPostingFid(null);
    }
  }

  const activeBtn = "bg-ink text-white";
  const inactiveBtn = "bg-card text-muted hover:text-ink";

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {lead}

        {/* Type filter */}
        <div className="flex gap-1 bg-card border border-line rounded-xl p-1">
          <button
            onClick={() => setFilterType("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterType === "ALL" ? activeBtn : inactiveBtn}`}
          >
            All
          </button>
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(filterType === t ? "ALL" : t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterType === t ? activeBtn : inactiveBtn}`}
            >
              {t.charAt(0) + t.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Status filter */}
        {showStatusFilter && (
          <div className="flex gap-1 bg-card border border-line rounded-xl p-1">
            {ACTIVE_STATUSES.map((s) => {
              const count = s === "OPEN" ? openCount : inProgressCount;
              return (
                <button
                  key={s}
                  onClick={() => setFilterStatus(filterStatus === s ? "ALL" : s)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterStatus === s ? activeBtn : inactiveBtn}`}
                >
                  {s === "IN_PROGRESS" ? "In progress" : "Open"}
                  {count > 0 && (
                    <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none ${filterStatus === s ? "bg-white/20 text-white" : "bg-line text-faint"}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Label filter */}
        {projectLabels.length > 0 && (
          <div className="flex gap-1 bg-card border border-line rounded-xl p-1">
            <button
              onClick={() => setFilterLabelId(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterLabelId === null ? activeBtn : inactiveBtn}`}
            >
              All labels
            </button>
            {projectLabels.map((l) => (
              <button
                key={l.id}
                onClick={() => setFilterLabelId(filterLabelId === l.id ? null : l.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterLabelId === l.id ? activeBtn : inactiveBtn}`}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: filterLabelId === l.id ? "currentColor" : l.color }}
                />
                {l.name}
              </button>
            ))}
          </div>
        )}

        {/* Sort toggle */}
        <button
          onClick={() => setSortBy(sortBy === "votes" ? "newest" : "votes")}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${sortBy === "votes" ? "bg-ink text-white border-transparent" : "bg-card text-muted border-line hover:text-ink"}`}
        >
          {sortBy === "votes" ? "Top voted" : "Newest"}
        </button>

        {/* Add task button */}
        <button
          onClick={openAddForm}
          className="ml-auto px-3.5 py-1.5 rounded-xl bg-clay text-white text-xs font-semibold hover:bg-clay-hover transition shadow-soft"
        >
          + Add task
        </button>
      </div>

      {/* Inline add-task form */}
      {showAddForm && (
        <form
          onSubmit={(e) => void submitAddTask(e)}
          className="mb-3 rounded-2xl border border-clay/30 bg-card shadow-soft p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-ink">New task</span>
            <button type="button" onClick={() => setShowAddForm(false)} className="text-xs text-faint hover:text-ink transition">
              ✕
            </button>
          </div>

          <input
            ref={titleRef}
            type="text"
            value={addTitle}
            onChange={(e) => setAddTitle(e.target.value)}
            placeholder="Title (required)"
            maxLength={200}
            required
            className="w-full text-sm rounded-xl border border-line bg-surface px-3 py-2 text-ink placeholder:text-faint focus:outline-none focus:border-clay/40 transition mb-2"
          />

          <textarea
            value={addContent}
            onChange={(e) => setAddContent(e.target.value)}
            placeholder="Description (optional)"
            maxLength={2000}
            rows={2}
            className="w-full text-sm rounded-xl border border-line bg-surface px-3 py-2 text-ink placeholder:text-faint focus:outline-none focus:border-clay/40 transition resize-none mb-3"
          />

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex gap-1">
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setAddType(t)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition ${addType === t ? TYPE_COLORS[t] : "bg-card text-muted border-line hover:border-line-strong"}`}
                >
                  {t.charAt(0) + t.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {ACTIVE_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setAddStatus(s)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition ${addStatus === s ? STATUS_COLORS[s] : "bg-card text-muted border-line hover:border-line-strong"}`}
                >
                  {s === "IN_PROGRESS" ? "In progress" : "Open"}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setAddInternal((v) => !v)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition ${addInternal ? "bg-violet-50 text-violet-700 border-violet-200" : "bg-card text-muted border-line hover:border-line-strong"}`}
            >
              Dev only
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={addSaving || !addTitle.trim()}
              className="px-4 py-2 rounded-xl bg-ink text-white text-sm font-medium hover:bg-ink/80 transition disabled:opacity-40"
            >
              {addSaving ? "Adding..." : "Add task"}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-xl border border-line text-sm text-muted hover:text-ink transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {displayedItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong bg-card/50 text-center py-20 text-muted text-sm">
          {items.length === 0 ? "No feedback yet." : "No feedback matches these filters."}
        </div>
      ) : (
        <div className="space-y-2">
          {displayedItems.map((f) => {
            const title = f.title ?? f.content;
            const hasDesc = Boolean(f.title);
            const itemComments = commentsByFid[f.id] ?? [];
            const fLabels = f.labels ?? [];
            const isPickerOpen = labelPickerFid === f.id;

            return (
              <div key={f.id} className="bg-card border border-line rounded-2xl overflow-hidden shadow-soft hover:border-line-strong transition">
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-surface/60 transition"
                  onClick={() => toggleExpanded(f.id)}
                >
                  {/* Upvote block */}
                  <div className="flex flex-col items-center justify-center w-11 shrink-0 rounded-xl border border-line bg-surface/60 py-1.5">
                    <span className="text-clay text-[11px] leading-none">▲</span>
                    <span className="text-sm font-semibold text-ink leading-tight">{f.upvotes}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink font-medium truncate">{title}</p>
                    {hasDesc && <p className="text-xs text-muted truncate mt-0.5">{f.content}</p>}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <p className="text-xs text-faint">{new Date(f.createdAt).toLocaleDateString()}</p>
                      {/* Label pills */}
                      {fLabels.map((l) => (
                        <span
                          key={l.id}
                          className="text-[10px] px-2 py-0.5 rounded-full font-medium border"
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
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold border bg-violet-50 text-violet-700 border-violet-200">
                          Dev only
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Badges + label button */}
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {/* Label picker trigger */}
                    <div className="relative" ref={isPickerOpen ? pickerRef : undefined}>
                      <button
                        onClick={() => {
                          setLabelPickerFid(isPickerOpen ? null : f.id);
                          setNewLabelName("");
                          setNewLabelColor(LABEL_PALETTE[0]!);
                        }}
                        className="text-[10px] px-2 py-0.5 rounded-full border border-dashed border-line text-faint hover:text-muted hover:border-line-strong transition"
                      >
                        + label
                      </button>

                      {isPickerOpen && (
                        <div className="absolute top-full right-0 mt-1 z-50 bg-white border border-line rounded-2xl shadow-lg p-2 w-52">
                          {/* Existing labels */}
                          {projectLabels.length > 0 && (
                            <div className="mb-1">
                              {projectLabels.map((l) => {
                                const has = fLabels.some((fl) => fl.id === l.id);
                                return (
                                  <button
                                    key={l.id}
                                    disabled={savingLabel}
                                    onClick={() => void toggleLabel(f.id, l.id, has)}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs hover:bg-surface transition text-left"
                                  >
                                    <span
                                      className="w-3 h-3 rounded-full flex-shrink-0"
                                      style={{ backgroundColor: l.color }}
                                    />
                                    <span className="flex-1 text-ink">{l.name}</span>
                                    {has && <span className="text-clay text-[10px]">✓</span>}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* Dev only toggle */}
                          <div className={projectLabels.length > 0 ? "border-t border-line pt-1 mt-1" : ""}>
                            <button
                              onClick={() => void toggleInternal(f.id, f.internal ?? false)}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs hover:bg-surface transition text-left"
                            >
                              <span
                                className="w-3 h-3 rounded-full flex-shrink-0 border-2"
                                style={f.internal ? { backgroundColor: "#7c3aed", borderColor: "#7c3aed" } : { borderColor: "#d1d5db" }}
                              />
                              <span className="flex-1 text-ink">Dev only</span>
                              {f.internal && <span className="text-clay text-[10px]">✓</span>}
                            </button>
                          </div>

                          {/* Create new label */}
                          <div className="border-t border-line pt-2 mt-2">
                            <p className="text-[10px] text-faint font-medium px-2 mb-1.5 uppercase tracking-wide">New label</p>
                            <input
                              type="text"
                              value={newLabelName}
                              onChange={(e) => setNewLabelName(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void createLabel(f.id); } }}
                              placeholder="Label name"
                              maxLength={50}
                              className="w-full text-xs rounded-lg border border-line bg-surface px-2 py-1.5 text-ink placeholder:text-faint focus:outline-none focus:border-clay/40 transition mb-2"
                            />
                            {/* Color swatches */}
                            <div className="flex gap-1 px-1 mb-2">
                              {LABEL_PALETTE.map((c) => (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => setNewLabelColor(c)}
                                  className={`w-5 h-5 rounded-full transition ${newLabelColor === c ? "ring-2 ring-offset-1 ring-ink/30" : ""}`}
                                  style={{ backgroundColor: c }}
                                />
                              ))}
                            </div>
                            <button
                              disabled={!newLabelName.trim() || savingLabel}
                              onClick={() => void createLabel(f.id)}
                              className="w-full text-xs px-3 py-1.5 rounded-lg bg-ink text-white font-medium hover:bg-ink/80 transition disabled:opacity-40"
                            >
                              Create & add
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <span className={`hidden sm:inline text-[10px] px-2 py-0.5 rounded-full font-medium border ${TYPE_COLORS[f.type]}`}>
                      {f.type}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${STATUS_COLORS[f.status]}`}>
                      {f.status.replace("_", " ")}
                    </span>
                  </div>
                </div>

                {/* Expanded panel */}
                {expanded === f.id && (
                  <div className="px-5 pb-5 border-t border-line">
                    {hasDesc && (
                      <p className="text-sm text-ink-soft mb-4 mt-3 leading-relaxed">{f.content}</p>
                    )}

                    {f.status === "PENDING" && (
                      <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-orange-50 border border-orange-100">
                        <span className="text-xs text-orange-700 font-medium flex-1">
                          {f.flagged ? "Flagged for profanity. Review before approving." : "Awaiting moderation review."}
                        </span>
                        <button
                          onClick={() => updateStatus(f.id, "OPEN")}
                          className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateStatus(f.id, "CLOSED")}
                          className="text-xs px-3 py-1.5 rounded-lg bg-card text-muted border border-line font-medium hover:text-ink hover:border-line-strong transition"
                        >
                          Reject
                        </button>
                      </div>
                    )}

                    {!hasDesc && (
                      <p className="text-sm text-ink-soft mb-4 mt-3 leading-relaxed">{f.content}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 mb-5">
                      <span className="text-xs text-muted font-medium">Status:</span>
                      {ACTIVE_STATUSES.map((s) => (
                        <button
                          key={s}
                          onClick={() => updateStatus(f.id, s)}
                          className={`text-xs px-2.5 py-1 rounded-full font-medium transition border ${f.status === s ? STATUS_COLORS[s] : "bg-card text-muted border-line hover:border-line-strong"}`}
                        >
                          {s === "IN_PROGRESS" ? "In progress" : "Open"}
                        </button>
                      ))}
                      <button
                        onClick={() => updateStatus(f.id, "DONE")}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium transition border ${f.status === "DONE" ? STATUS_COLORS["DONE"] : "bg-card text-muted border-line hover:border-line-strong"}`}
                      >
                        Done
                      </button>
                      <button
                        onClick={() => deleteFeedback(f.id)}
                        className="ml-auto text-xs text-red-400 hover:text-red-600 transition"
                      >
                        Delete
                      </button>
                    </div>

                    {/* Developer comments */}
                    <div className="pt-4 border-t border-line">
                      <p className="text-[10px] font-semibold tracking-widest text-faint uppercase mb-3">
                        Developer response
                      </p>

                      {itemComments.length > 0 && (
                        <div className="space-y-2 mb-3">
                          {itemComments.map((c) => (
                            <div key={c.id} className="bg-surface rounded-xl border border-line p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[11px] font-semibold text-clay">{c.authorName ?? "You"}</span>
                                <span className="text-[11px] text-faint">{new Date(c.createdAt).toLocaleDateString()}</span>
                              </div>
                              <p className="text-sm text-ink-soft leading-relaxed">{c.content}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <input
                          value={inputByFid[f.id] ?? ""}
                          onChange={(e) => setInputByFid((prev) => ({ ...prev, [f.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void postComment(f.id); }
                          }}
                          placeholder="Reply to this feedback..."
                          className="flex-1 text-sm rounded-xl border border-line bg-surface px-3 py-2 text-ink placeholder:text-faint focus:outline-none focus:border-clay/40 transition"
                        />
                        <button
                          onClick={() => void postComment(f.id)}
                          disabled={postingFid === f.id || !inputByFid[f.id]?.trim()}
                          className="px-4 py-2 rounded-xl bg-ink text-white text-sm font-medium hover:bg-ink/80 transition disabled:opacity-40"
                        >
                          Post
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
