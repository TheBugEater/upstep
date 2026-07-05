"use client";

import { useState } from "react";
import type { FeedbackType, Label } from "@upstep/types";
import type { ProjectBoard, ProjectStatus } from "@/types/dashboard";
import type { NewTaskInput } from "./ProjectWorkspace";
import {
  ModalShell,
  inputCls,
  btnPrimary,
  btnGhost,
  TYPES,
  TYPE_COLORS,
  TYPE_LABELS,
  STATUS_PALETTE,
  LABEL_PALETTE,
  StatusDot,
} from "./ui";

// ─── New task ─────────────────────────────────────────────────────────────────

export function NewTaskModal({
  statuses,
  labels,
  presetStatusId,
  onCreate,
  onClose,
}: {
  statuses: ProjectStatus[];
  labels: Label[];
  presetStatusId: string | null;
  onCreate: (input: NewTaskInput) => Promise<boolean>;
  onClose: () => void;
}) {
  const defaultStatusId =
    presetStatusId ?? statuses.find((s) => !s.isDone)?.id ?? statuses[0]?.id ?? null;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<FeedbackType>("FEATURE");
  const [statusId, setStatusId] = useState<string | null>(defaultStatusId);
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [internal, setInternal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    setError(null);
    const ok = await onCreate({
      title: title.trim(),
      content: content.trim() || title.trim(),
      type,
      statusId,
      labelIds,
      internal,
    });
    setSaving(false);
    if (ok) onClose();
    else setError("Failed to create the task. Please try again.");
  }

  return (
    <ModalShell onClose={onClose} wide>
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <h3 className="font-semibold text-ink">New task</h3>

        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (required)"
          maxLength={200}
          required
          className={inputCls}
        />

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Description (optional)"
          maxLength={2000}
          rows={3}
          className={`${inputCls} resize-none`}
        />

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <div>
            <p className="text-[11px] font-medium text-muted mb-1.5">Type</p>
            <div className="flex gap-1">
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition ${
                    type === t ? TYPE_COLORS[t] : "bg-card text-muted border-line hover:border-line-strong"
                  }`}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-medium text-muted mb-1.5">Visibility</p>
            <button
              type="button"
              onClick={() => setInternal((v) => !v)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition ${
                internal
                  ? "bg-violet-500/10 text-violet-500 border-violet-500/30"
                  : "bg-card text-muted border-line hover:border-line-strong"
              }`}
            >
              {internal ? "Dev only ✓" : "Dev only"}
            </button>
          </div>
        </div>

        {statuses.length > 0 && (
          <div>
            <p className="text-[11px] font-medium text-muted mb-1.5">Status</p>
            <div className="flex flex-wrap gap-1.5">
              {statuses.map((s) => {
                const active = statusId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStatusId(s.id)}
                    className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full font-medium border transition ${
                      active ? "text-white border-transparent" : "bg-card border-line text-muted hover:border-line-strong"
                    }`}
                    style={active ? { backgroundColor: s.color, borderColor: s.color } : {}}
                  >
                    <StatusDot color={active ? "rgba(255,255,255,0.7)" : s.color} />
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {labels.length > 0 && (
          <div>
            <p className="text-[11px] font-medium text-muted mb-1.5">Labels</p>
            <div className="flex flex-wrap gap-1.5">
              {labels.map((l) => {
                const has = labelIds.includes(l.id);
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() =>
                      setLabelIds((prev) =>
                        has ? prev.filter((x) => x !== l.id) : [...prev, l.id]
                      )
                    }
                    className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full font-medium border transition ${
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

        {error && <p className="text-xs text-danger">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className={`flex-1 ${btnGhost}`}>
            Cancel
          </button>
          <button type="submit" disabled={saving || !title.trim()} className={`flex-1 ${btnPrimary}`}>
            {saving ? "Creating…" : "Create task"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Board create / edit ──────────────────────────────────────────────────────

export function BoardFormModal({
  projectId,
  statuses,
  labels,
  board,
  canDelete,
  onSaved,
  onDeleted,
  onClose,
  onCreateLabel,
}: {
  projectId: string;
  statuses: ProjectStatus[];
  labels: Label[];
  board: ProjectBoard | null; // null = create mode
  canDelete: boolean;
  onSaved: (board: ProjectBoard) => void;
  onDeleted: (boardId: string) => void;
  onClose: () => void;
  onCreateLabel: (name: string, color: string) => Promise<Label | null>;
}) {
  const isMain = board?.isDefault ?? false;

  const [name, setName] = useState(board?.name ?? "");
  const [columnIds, setColumnIds] = useState<string[]>(
    board ? board.columns.map((c) => c.statusId) : statuses.map((s) => s.id)
  );
  const [labelIds, setLabelIds] = useState<string[]>(board?.filters?.labelIds ?? []);
  const [types, setTypes] = useState<FeedbackType[]>(board?.filters?.types ?? []);
  const [createdAfter, setCreatedAfter] = useState(board?.filters?.createdAfter?.slice(0, 10) ?? "");
  const [createdBefore, setCreatedBefore] = useState(board?.filters?.createdBefore?.slice(0, 10) ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showNewLabel, setShowNewLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState(LABEL_PALETTE[0]!);
  const [savingLabel, setSavingLabel] = useState(false);

  const available = statuses.filter((s) => !columnIds.includes(s.id));
  const hasFilters = labelIds.length > 0 || types.length > 0 || !!createdAfter || !!createdBefore;

  async function addLabel() {
    const trimmed = newLabelName.trim();
    if (!trimmed || savingLabel) return;
    setSavingLabel(true);
    try {
      const label = await onCreateLabel(trimmed, newLabelColor);
      if (label) {
        setLabelIds((prev) => (prev.includes(label.id) ? prev : [...prev, label.id]));
        setNewLabelName("");
        setShowNewLabel(false);
      }
    } finally {
      setSavingLabel(false);
    }
  }

  function moveColumn(index: number, dir: -1 | 1) {
    setColumnIds((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j]!, next[index]!];
      return next;
    });
  }

  function toggle<T>(list: T[], setList: (v: T[]) => void, value: T) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  async function save() {
    if (!name.trim() || columnIds.length === 0 || saving) return;
    setSaving(true);
    setError(null);
    try {
      const url = board
        ? `/api/projects/${projectId}/boards/${board.id}`
        : `/api/projects/${projectId}/boards`;
      const body: Record<string, unknown> = { name: name.trim(), columnStatusIds: columnIds };
      if (!isMain) {
        body.filters = hasFilters
          ? {
              ...(labelIds.length ? { labelIds } : {}),
              ...(types.length ? { types } : {}),
              ...(createdAfter ? { createdAfter } : {}),
              ...(createdBefore ? { createdBefore } : {}),
            }
          : null;
      }
      const res = await fetch(url, {
        method: board ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError("Failed to save the board.");
        return;
      }
      onSaved((await res.json()) as ProjectBoard);
    } finally {
      setSaving(false);
    }
  }

  async function deleteBoard() {
    if (!board || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/boards/${board.id}`, {
        method: "DELETE",
      });
      if (res.ok) onDeleted(board.id);
      else setError("Cannot delete this board.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell onClose={onClose} wide>
      <div className="space-y-4">
        <h3 className="font-semibold text-ink">{board ? "Edit board" : "New board"}</h3>

        <div>
          <label className="text-xs font-medium text-muted mb-1 block">Board name</label>
          <input
            autoFocus={!board}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Roadmap"
            maxLength={100}
            className={inputCls}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted mb-2 block">
            Columns <span className="text-faint"> - top to bottom = left to right</span>
          </label>
          <div className="space-y-1.5">
            {columnIds.map((sid, i) => {
              const s = statuses.find((x) => x.id === sid);
              if (!s) return null;
              return (
                <div
                  key={sid}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-line bg-surface"
                >
                  <StatusDot color={s.color} />
                  <span className="text-sm text-ink flex-1 truncate">{s.name}</span>
                  {s.isDone && <span className="text-[10px] text-faint">done</span>}
                  <button
                    onClick={() => moveColumn(i, -1)}
                    disabled={i === 0}
                    className="text-xs text-muted hover:text-ink disabled:opacity-25 transition px-1"
                    aria-label="Move up"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveColumn(i, 1)}
                    disabled={i === columnIds.length - 1}
                    className="text-xs text-muted hover:text-ink disabled:opacity-25 transition px-1"
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => setColumnIds((prev) => prev.filter((x) => x !== sid))}
                    className="text-xs text-faint hover:text-danger transition px-1"
                    aria-label={`Remove ${s.name}`}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
            {columnIds.length === 0 && (
              <p className="text-xs text-faint py-2">No columns, add at least one below.</p>
            )}
          </div>

          {available.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {available.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setColumnIds((prev) => [...prev, s.id])}
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-dashed border-line text-muted hover:border-line-strong hover:text-ink transition"
                >
                  <StatusDot color={s.color} className="!w-1.5 !h-1.5" />+ {s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {isMain ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-3">
            <span className="text-clay text-sm shrink-0">★</span>
            <p className="text-xs text-muted leading-relaxed">
              This is the <span className="font-medium text-ink">main board</span>. It always
              shows every task, ignores filters, and can&apos;t be deleted.
            </p>
          </div>
        ) : (
          <div>
            <label className="text-xs font-medium text-muted mb-2 block">
              Filters <span className="text-faint"> - only matching tasks show on this board</span>
            </label>
            <div className="space-y-3 rounded-xl border border-line bg-surface p-3.5">
              <div>
                <p className="text-[11px] font-medium text-muted mb-1.5">Type</p>
                <div className="flex flex-wrap gap-1.5">
                  {TYPES.map((t) => {
                    const active = types.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggle(types, setTypes, t)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition ${
                          active ? TYPE_COLORS[t] : "bg-card text-muted border-line hover:border-line-strong"
                        }`}
                      >
                        {TYPE_LABELS[t]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-medium text-muted mb-1.5">Labels</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {labels.map((l) => {
                    const active = labelIds.includes(l.id);
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => toggle(labelIds, setLabelIds, l.id)}
                        className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full font-medium border transition ${
                          active ? "text-white border-transparent" : "bg-card border-line text-muted hover:border-line-strong"
                        }`}
                        style={active ? { backgroundColor: l.color, borderColor: l.color } : {}}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: active ? "rgba(255,255,255,0.7)" : l.color }}
                        />
                        {l.name}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setShowNewLabel((v) => !v)}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-dashed border-line text-faint hover:text-muted hover:border-line-strong transition"
                  >
                    + New label
                  </button>
                </div>

                {showNewLabel && (
                  <div className="mt-2.5 rounded-xl border border-line bg-card p-3">
                    <input
                      autoFocus
                      value={newLabelName}
                      onChange={(e) => setNewLabelName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void addLabel();
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
                        type="button"
                        onClick={() => void addLabel()}
                        disabled={!newLabelName.trim() || savingLabel}
                        className="ml-auto text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-fg font-medium hover:bg-primary/85 disabled:opacity-40 transition"
                      >
                        {savingLabel ? "Adding…" : "Create & add"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                <div>
                  <p className="text-[11px] font-medium text-muted mb-1.5">Created after</p>
                  <input
                    type="date"
                    value={createdAfter}
                    onChange={(e) => setCreatedAfter(e.target.value)}
                    className="text-xs rounded-lg border border-line bg-card py-1.5 px-2.5 text-ink focus:outline-none focus:border-clay/40 transition"
                  />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-muted mb-1.5">Created before</p>
                  <input
                    type="date"
                    value={createdBefore}
                    onChange={(e) => setCreatedBefore(e.target.value)}
                    className="text-xs rounded-lg border border-line bg-card py-1.5 px-2.5 text-ink focus:outline-none focus:border-clay/40 transition"
                  />
                </div>
              </div>

              {!hasFilters && (
                <p className="text-[11px] text-faint">No filters set, this board will show everything.</p>
              )}
            </div>
          </div>
        )}

        {error && <p className="text-xs text-danger">{error}</p>}

        <div className="flex gap-2 pt-1">
          {board && canDelete && (
            confirmingDelete ? (
              <button
                onClick={() => void deleteBoard()}
                disabled={saving}
                className="text-xs px-3 py-2 rounded-xl bg-danger text-white font-semibold hover:bg-danger/85 disabled:opacity-40 transition"
              >
                Confirm delete
              </button>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="text-xs px-3 py-2 rounded-xl border border-line text-danger hover:text-danger hover:border-danger/30 transition"
              >
                Delete board…
              </button>
            )
          )}
          <button onClick={onClose} className={`flex-1 ${btnGhost}`}>
            Cancel
          </button>
          <button
            onClick={() => void save()}
            disabled={saving || !name.trim() || columnIds.length === 0}
            className={`flex-1 ${btnPrimary}`}
          >
            {saving ? "Saving…" : board ? "Save board" : "Create board"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ─── Manage statuses ──────────────────────────────────────────────────────────

export function ManageStatusesModal({
  projectId,
  statuses,
  onCreated,
  onUpdated,
  onDeleted,
  onClose,
}: {
  projectId: string;
  statuses: ProjectStatus[];
  onCreated: (status: ProjectStatus, addedToBoards: boolean) => void;
  onUpdated: (status: ProjectStatus) => void;
  onDeleted: (statusId: string) => void;
  onClose: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(STATUS_PALETTE[0]!);
  const [newIsDone, setNewIsDone] = useState(false);
  const [addToBoards, setAddToBoards] = useState(true);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function patchStatus(id: string, patch: Partial<ProjectStatus>): Promise<boolean> {
    const res = await fetch(`/api/projects/${projectId}/statuses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return false;
    onUpdated((await res.json()) as ProjectStatus);
    return true;
  }

  async function addStatus() {
    if (!newName.trim() || adding) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/statuses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          color: newColor,
          isDone: newIsDone,
          addToBoards,
        }),
      });
      if (!res.ok) {
        setError("Failed to create status, the name may already exist.");
        return;
      }
      onCreated((await res.json()) as ProjectStatus, addToBoards);
      setNewName("");
      setNewIsDone(false);
    } finally {
      setAdding(false);
    }
  }

  async function reorder(index: number, dir: -1 | 1) {
    const a = statuses[index];
    const b = statuses[index + dir];
    if (!a || !b || busyId) return;
    setBusyId(a.id);
    try {
      // Swap the two order values; parent state re-sorts on each update
      await Promise.all([
        patchStatus(a.id, { order: b.order }),
        patchStatus(b.id, { order: a.order }),
      ]);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteStatus(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/statuses/${id}`, { method: "DELETE" });
      if (res.ok) onDeleted(id);
      else setError("Cannot delete the last status.");
    } finally {
      setBusyId(null);
      setConfirmDeleteId(null);
    }
  }

  return (
    <ModalShell onClose={onClose} wide>
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold text-ink">Statuses</h3>
          <p className="text-xs text-muted mt-0.5">
            Statuses are shared across boards. Changes apply everywhere instantly.
          </p>
        </div>

        <div className="space-y-2">
          {statuses.map((s, i) => (
            <StatusRow
              key={s.id}
              status={s}
              busy={busyId === s.id}
              canMoveUp={i > 0}
              canMoveDown={i < statuses.length - 1}
              confirmingDelete={confirmDeleteId === s.id}
              onRename={(name) => void patchStatus(s.id, { name })}
              onRecolor={(color) => void patchStatus(s.id, { color })}
              onToggleDone={() => void patchStatus(s.id, { isDone: !s.isDone })}
              onMove={(dir) => void reorder(i, dir)}
              onDeleteIntent={() => setConfirmDeleteId(s.id)}
              onDeleteConfirm={() => void deleteStatus(s.id)}
              onDeleteCancel={() => setConfirmDeleteId(null)}
            />
          ))}
        </div>

        <div className="border-t border-line pt-4 space-y-3">
          <p className="text-xs font-medium text-muted">Add new status</p>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addStatus();
                }
              }}
              placeholder="Status name"
              maxLength={50}
              className={inputCls}
            />
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="w-9 h-9 rounded-lg cursor-pointer border border-line shrink-0"
              aria-label="Status color"
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={newIsDone}
                onChange={(e) => setNewIsDone(e.target.checked)}
                className="rounded border-line"
              />
              Counts as done
            </label>
            <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={addToBoards}
                onChange={(e) => setAddToBoards(e.target.checked)}
                className="rounded border-line"
              />
              Add as a column on all boards
            </label>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <button
            onClick={() => void addStatus()}
            disabled={adding || !newName.trim()}
            className={`w-full ${btnPrimary}`}
          >
            {adding ? "Adding…" : "Add status"}
          </button>
        </div>

        <button onClick={onClose} className={`w-full ${btnGhost}`}>
          Done
        </button>
      </div>
    </ModalShell>
  );
}

function StatusRow({
  status,
  busy,
  canMoveUp,
  canMoveDown,
  confirmingDelete,
  onRename,
  onRecolor,
  onToggleDone,
  onMove,
  onDeleteIntent,
  onDeleteConfirm,
  onDeleteCancel,
}: {
  status: ProjectStatus;
  busy: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  confirmingDelete: boolean;
  onRename: (name: string) => void;
  onRecolor: (color: string) => void;
  onToggleDone: () => void;
  onMove: (dir: -1 | 1) => void;
  onDeleteIntent: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
}) {
  const [name, setName] = useState(status.name);

  function commitName() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== status.name) onRename(trimmed);
    else setName(status.name);
  }

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-xl border border-line bg-surface ${
        busy ? "opacity-60 pointer-events-none" : ""
      }`}
    >
      <input
        type="color"
        value={status.color}
        onChange={(e) => onRecolor(e.target.value)}
        className="w-6 h-6 rounded cursor-pointer border border-line shrink-0"
        aria-label={`Color for ${status.name}`}
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        maxLength={50}
        className="flex-1 min-w-0 text-sm text-ink bg-transparent focus:outline-none focus:bg-card rounded-lg px-2 py-1 border border-transparent focus:border-clay/40 transition"
      />
      <button
        onClick={onToggleDone}
        className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold transition shrink-0 ${
          status.isDone
            ? "bg-success/10 text-success border-success/30"
            : "bg-card text-faint border-line hover:text-muted hover:border-line-strong"
        }`}
        title="Cards in a done status move to the Completed tab"
      >
        done
      </button>
      <button
        onClick={() => onMove(-1)}
        disabled={!canMoveUp}
        className="text-xs text-muted hover:text-ink disabled:opacity-25 transition px-0.5 shrink-0"
        aria-label="Move up"
      >
        ↑
      </button>
      <button
        onClick={() => onMove(1)}
        disabled={!canMoveDown}
        className="text-xs text-muted hover:text-ink disabled:opacity-25 transition px-0.5 shrink-0"
        aria-label="Move down"
      >
        ↓
      </button>
      {confirmingDelete ? (
        <span className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onDeleteConfirm}
            className="text-[10px] px-2 py-1 rounded-lg bg-danger text-white font-semibold hover:bg-danger/85 transition"
          >
            Delete
          </button>
          <button onClick={onDeleteCancel} className="text-[10px] text-muted hover:text-ink transition">
            Cancel
          </button>
        </span>
      ) : (
        <button
          onClick={onDeleteIntent}
          className="text-xs text-faint hover:text-danger transition shrink-0 px-0.5"
          aria-label={`Delete ${status.name}`}
        >
          ✕
        </button>
      )}
    </div>
  );
}

// ─── Manage labels ────────────────────────────────────────────────────────────

export function ManageLabelsModal({
  projectId,
  labels,
  onCreated,
  onUpdated,
  onDeleted,
  onClose,
}: {
  projectId: string;
  labels: Label[];
  onCreated: (label: Label) => void;
  onUpdated: (label: Label) => void;
  onDeleted: (labelId: string) => void;
  onClose: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(LABEL_PALETTE[0]!);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function patchLabel(id: string, patch: Partial<Label>): Promise<boolean> {
    const res = await fetch(`/api/projects/${projectId}/labels/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return false;
    onUpdated((await res.json()) as Label);
    return true;
  }

  async function addLabel() {
    if (!newName.trim() || adding) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/labels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      });
      if (!res.ok) {
        setError("Failed to create label, the name may already exist.");
        return;
      }
      onCreated((await res.json()) as Label);
      setNewName("");
    } finally {
      setAdding(false);
    }
  }

  async function deleteLabel(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/labels/${id}`, { method: "DELETE" });
      if (res.ok) onDeleted(id);
      else setError("Failed to delete the label.");
    } finally {
      setBusyId(null);
      setConfirmDeleteId(null);
    }
  }

  return (
    <ModalShell onClose={onClose} wide>
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold text-ink">Labels</h3>
          <p className="text-xs text-muted mt-0.5">
            Shared across the project. Deleting a label removes it from every task and board filter.
          </p>
        </div>

        <div className="space-y-2">
          {labels.length === 0 && (
            <p className="text-xs text-faint py-2">No labels yet, add one below.</p>
          )}
          {labels.map((l) => (
            <LabelRow
              key={l.id}
              label={l}
              busy={busyId === l.id}
              confirmingDelete={confirmDeleteId === l.id}
              onRename={(name) => void patchLabel(l.id, { name })}
              onRecolor={(color) => void patchLabel(l.id, { color })}
              onDeleteIntent={() => setConfirmDeleteId(l.id)}
              onDeleteConfirm={() => void deleteLabel(l.id)}
              onDeleteCancel={() => setConfirmDeleteId(null)}
            />
          ))}
        </div>

        <div className="border-t border-line pt-4 space-y-3">
          <p className="text-xs font-medium text-muted">Add new label</p>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addLabel();
                }
              }}
              placeholder="Label name"
              maxLength={50}
              className={inputCls}
            />
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="w-9 h-9 rounded-lg cursor-pointer border border-line shrink-0"
              aria-label="Label color"
            />
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <button
            onClick={() => void addLabel()}
            disabled={adding || !newName.trim()}
            className={`w-full ${btnPrimary}`}
          >
            {adding ? "Adding…" : "Add label"}
          </button>
        </div>

        <button onClick={onClose} className={`w-full ${btnGhost}`}>
          Done
        </button>
      </div>
    </ModalShell>
  );
}

function LabelRow({
  label,
  busy,
  confirmingDelete,
  onRename,
  onRecolor,
  onDeleteIntent,
  onDeleteConfirm,
  onDeleteCancel,
}: {
  label: Label;
  busy: boolean;
  confirmingDelete: boolean;
  onRename: (name: string) => void;
  onRecolor: (color: string) => void;
  onDeleteIntent: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
}) {
  const [name, setName] = useState(label.name);

  function commitName() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== label.name) onRename(trimmed);
    else setName(label.name);
  }

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-xl border border-line bg-surface ${
        busy ? "opacity-60 pointer-events-none" : ""
      }`}
    >
      <input
        type="color"
        value={label.color}
        onChange={(e) => onRecolor(e.target.value)}
        className="w-6 h-6 rounded cursor-pointer border border-line shrink-0"
        aria-label={`Color for ${label.name}`}
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        maxLength={50}
        className="flex-1 min-w-0 text-sm text-ink bg-transparent focus:outline-none focus:bg-card rounded-lg px-2 py-1 border border-transparent focus:border-clay/40 transition"
      />
      {confirmingDelete ? (
        <span className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onDeleteConfirm}
            className="text-[10px] px-2 py-1 rounded-lg bg-danger text-white font-semibold hover:bg-danger/85 transition"
          >
            Delete
          </button>
          <button onClick={onDeleteCancel} className="text-[10px] text-muted hover:text-ink transition">
            Cancel
          </button>
        </span>
      ) : (
        <button
          onClick={onDeleteIntent}
          className="text-xs text-faint hover:text-danger transition shrink-0 px-0.5"
          aria-label={`Delete ${label.name}`}
        >
          ✕
        </button>
      )}
    </div>
  );
}
