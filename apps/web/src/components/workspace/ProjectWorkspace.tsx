"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { FeedbackType, Label } from "@upstep/types";
import type { BoardFilters, ProjectBoard, ProjectStatus, WorkspaceItem } from "@/types/dashboard";
import { SupportPanel } from "@/components/support/SupportPanel";
import { SettingsTab } from "@/components/dashboard/SettingsTab";
import { IntegrationsTab } from "@/components/dashboard/IntegrationsTab";
import { McpCard } from "@/components/dashboard/McpCard";
import { SetupGuideButton } from "@/components/dashboard/SetupGuide";
import { BoardView } from "./BoardView";
import { ListView } from "./ListView";
import { DetailDrawer } from "./DetailDrawer";
import { PendingList } from "./PendingList";
import {
  NewTaskModal,
  BoardFormModal,
  ManageStatusesModal,
  ManageLabelsModal,
} from "./modals";
import { TYPES, TYPE_LABELS, TYPE_COLORS } from "./ui";

type Tab = "support" | "feedback" | "completed" | "pending" | "mcp" | "integrations" | "settings";
type View = "board" | "list";
type SortMode = "newest" | "votes";

export interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
}

export interface NewTaskInput {
  title: string;
  content: string;
  type: FeedbackType;
  statusId: string | null;
  labelIds: string[];
  internal: boolean;
  assigneeId?: string | null;
}

/** Everything child views need to mutate workspace state. */
export interface WorkspaceActions {
  moveItem: (id: string, statusId: string) => void;
  updateItem: (id: string, patch: Record<string, unknown>) => Promise<boolean>;
  deleteItem: (id: string) => Promise<void>;
  toggleItemLabel: (id: string, label: Label, has: boolean) => Promise<void>;
  createLabel: (name: string, color: string) => Promise<Label | null>;
  createTask: (input: NewTaskInput) => Promise<boolean>;
  openDetail: (id: string) => void;
  openQuickAdd: (statusId: string | null) => void;
}

interface Props {
  projectId: string;
  projectSlug: string;
  apiKey: string;
  baseUrl: string;
  mcpConfigured: boolean;
  moderationEnabled: boolean;
  isOwner: boolean;
  canManage: boolean;
  currentUserId: string;
  ownerPlan: string;
  teamMembers: TeamMember[];
  initialItems: WorkspaceItem[];
  initialPending: WorkspaceItem[];
  initialBoards: ProjectBoard[];
  initialStatuses: ProjectStatus[];
  initialLabels: Label[];
  /** Render this task on its own page instead of the workspace tabs. */
  taskPageId?: string | undefined;
}

const chipSelect = (active: boolean) =>
  `h-9 rounded-lg border px-2.5 text-xs font-medium transition focus:outline-none focus:ring-4 focus:ring-clay/10 ${active ? "border-clay/40 bg-clay-tint text-ink" : "border-line bg-card text-muted hover:border-line-strong hover:text-ink"}`;

export function ProjectWorkspace({
  projectId,
  projectSlug,
  apiKey,
  baseUrl,
  mcpConfigured,
  moderationEnabled,
  isOwner,
  canManage,
  currentUserId,
  ownerPlan,
  teamMembers: initialTeamMembers,
  initialItems,
  initialPending,
  initialBoards,
  initialStatuses,
  initialLabels,
  taskPageId,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // ── Shared data state (single source of truth for the whole page) ─────────
  const [items, setItems] = useState<WorkspaceItem[]>(initialItems);
  const [pending, setPending] = useState<WorkspaceItem[]>(initialPending);
  const [boards, setBoards] = useState<ProjectBoard[]>(initialBoards);
  const [statuses, setStatuses] = useState<ProjectStatus[]>(initialStatuses);
  const [labels, setLabels] = useState<Label[]>(initialLabels);
  const [teamMembers, setTeamMembers] = useState(initialTeamMembers);
  const [assigneeFilter, setAssigneeFilter] = useState(isOwner ? "all" : "mine");

  // ── UI state ───────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>("feedback");
  const [view, setView] = useState<View>("board");
  const [activeBoardId, setActiveBoardId] = useState<string>(
    initialBoards.find((b) => b.isDefault)?.id ?? initialBoards[0]?.id ?? ""
  );
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<FeedbackType | "ALL">("ALL");
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortMode>("votes");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quickAdd, setQuickAdd] = useState<{ open: boolean; statusId: string | null }>({
    open: false,
    statusId: null,
  });
  const [boardModal, setBoardModal] = useState<"new" | "edit" | null>(null);
  const [showStatuses, setShowStatuses] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [showLabelFilter, setShowLabelFilter] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  // Suppress background refresh right after an optimistic mutation so a
  // stale in-flight poll can't briefly revert what the user just did.
  const lastMutation = useRef(0);

  // Restore the preferred layout per project
  useEffect(() => {
    const saved = localStorage.getItem(`upstep:view:${projectId}`);
    if (saved === "list" || saved === "board") setView(saved);
  }, [projectId]);

  useEffect(() => {
    const nextTab = searchParams.get("tab");
    if (nextTab === "support" || nextTab === "feedback" || nextTab === "mcp" || nextTab === "integrations" || nextTab === "settings" || nextTab === "pending" || nextTab === "completed") setTab(nextTab);
    else setTab("feedback");

    const panel = searchParams.get("panel");
    setShowStatuses(panel === "statuses");
    setShowLabels(panel === "labels");
    setSelectedId(searchParams.get("issue"));
  }, [searchParams]);

  function switchTab(nextTab: Tab) {
    router.push(`/dashboard/projects/${projectId}?tab=${nextTab}`);
  }

  function closeSettingsPanel() {
    setShowStatuses(false);
    setShowLabels(false);
    // Statuses and labels open from the board's Customize menu or from Settings.
    router.replace(`/dashboard/projects/${projectId}?tab=${tab}`);
  }

  function switchView(v: View) {
    setView(v);
    localStorage.setItem(`upstep:view:${projectId}`, v);
  }

  const activeBoard = boards.find((b) => b.id === activeBoardId) ?? boards[0] ?? null;

  // ── Derived sets ───────────────────────────────────────────────────────────
  const isDone = useCallback(
    (f: WorkspaceItem) => f.boardStatus?.isDone ?? f.status === "DONE",
    []
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = items;
    if (q) {
      result = result.filter(
        (f) =>
          f.title?.toLowerCase().includes(q) || f.content.toLowerCase().includes(q)
      );
    }
    if (typeFilter !== "ALL") result = result.filter((f) => f.type === typeFilter);
    if (assigneeFilter === "mine") result = result.filter((f) => f.assigneeId === currentUserId);
    else if (assigneeFilter === "unassigned") result = result.filter((f) => !f.assigneeId);
    else if (assigneeFilter !== "all") result = result.filter((f) => f.assigneeId === assigneeFilter);
    if (labelFilter) result = result.filter((f) => f.labels?.some((l) => l.id === labelFilter));
    return [...result].sort((a, b) =>
      sortBy === "votes"
        ? b.upvotes - a.upvotes
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [items, search, typeFilter, labelFilter, sortBy, assigneeFilter, currentUserId]);

  // The main board always shows everything; other boards additionally apply
  // their own saved filters (labels, type, date range) on top of the
  // toolbar's search/type/label filters above.
  const boardFiltered = useMemo(() => {
    const f = activeBoard?.filters;
    if (activeBoard?.isDefault || !f) return filtered;
    return filtered.filter((item) => {
      if (f.labelIds?.length && !(item.labels ?? []).some((l) => f.labelIds!.includes(l.id))) return false;
      if (f.types?.length && !f.types.includes(item.type)) return false;
      if (f.createdAfter && new Date(item.createdAt) < new Date(f.createdAfter)) return false;
      if (f.createdBefore && new Date(item.createdAt) > new Date(f.createdBefore)) return false;
      return true;
    });
  }, [filtered, activeBoard]);

  const activeItems = useMemo(() => filtered.filter((f) => !isDone(f)), [filtered, isDone]);
  const completedItems = useMemo(() => filtered.filter(isDone), [filtered, isDone]);
  const activeCount = useMemo(() => items.filter((f) => !isDone(f)).length, [items, isDone]);
  const completedCount = items.length - activeCount;

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("upstep:project-counts", { detail: { id: projectId, feedbackCount: items.length + pending.length, activeCount, completedCount, pendingCount: pending.length } }));
  }, [projectId, items.length, pending.length, activeCount, completedCount]);

  const selectedItem = items.find((f) => f.id === selectedId) ?? pending.find((f) => f.id === selectedId) ?? null;

  // ── Background refresh: poll + on window focus ────────────────────────────
  const refresh = useCallback(async () => {
    if (Date.now() - lastMutation.current < 5_000) return;
    try {
      const res = await fetch(
        `/api/projects/${projectId}/feedback?status=OPEN,IN_PROGRESS,DONE,PENDING&take=300&includeMine=1`
      );
      if (!res.ok) return;
      const data = (await res.json()) as WorkspaceItem[];
      if (Date.now() - lastMutation.current < 5_000) return;
      setItems(data.filter((f) => f.status !== "PENDING"));
      setPending(data.filter((f) => f.status === "PENDING"));
    } catch {
      /* transient network error - next poll will retry */
    }
  }, [projectId]);

  useEffect(() => {
    const interval = setInterval(() => void refresh(), 30_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  // ── Keyboard shortcuts: n = new task, / = search ───────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable) return;
      if (tab !== "feedback" || selectedId || quickAdd.open || boardModal || showStatuses || showLabels) return;
      if (e.key === "n") {
        e.preventDefault();
        setQuickAdd({ open: true, statusId: null });
      } else if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, selectedId, quickAdd.open, boardModal, showStatuses, showLabels]);

  // ── Item mutations (optimistic) ────────────────────────────────────────────
  const moveItem = useCallback(
    (id: string, statusId: string) => {
      const current = items.find((f) => f.id === id);
      if (!current || current.statusId === statusId) return;
      const target = statuses.find((s) => s.id === statusId) ?? null;
      lastMutation.current = Date.now();
      setItems((prev) =>
        prev.map((f) =>
          f.id === id
            ? { ...f, statusId, boardStatus: target, status: target?.isDone ? "DONE" : "OPEN" }
            : f
        )
      );
      void fetch(`/api/projects/${projectId}/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusId }),
      }).then((res) => {
        if (!res.ok) setItems((prev) => prev.map((f) => (f.id === id ? current : f)));
      });
    },
    [items, statuses, projectId]
  );

  const updateItem = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      lastMutation.current = Date.now();
      const res = await fetch(`/api/projects/${projectId}/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const updated = (await res.json()) as WorkspaceItem;
        setItems((prev) => prev.map((f) => (f.id === id ? { ...f, ...updated } : f)));
        setPending((prev) => prev.map((f) => (f.id === id ? { ...f, ...updated } : f)));
      }
      return res.ok;
    },
    [projectId]
  );

  const deleteItem = useCallback(
    async (id: string) => {
      lastMutation.current = Date.now();
      const res = await fetch(`/api/projects/${projectId}/feedback/${id}`, { method: "DELETE" });
      if (res.ok) {
        setItems((prev) => prev.filter((f) => f.id !== id));
        setSelectedId((sel) => (sel === id ? null : sel));
      }
    },
    [projectId]
  );

  const toggleItemLabel = useCallback(
    async (id: string, label: Label, has: boolean) => {
      lastMutation.current = Date.now();
      setItems((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                labels: has
                  ? (f.labels ?? []).filter((l) => l.id !== label.id)
                  : [...(f.labels ?? []), label],
              }
            : f
        )
      );
      await fetch(`/api/projects/${projectId}/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(has ? { removeLabelId: label.id } : { addLabelId: label.id }),
      });
    },
    [projectId]
  );

  const createLabel = useCallback(
    async (name: string, color: string): Promise<Label | null> => {
      const res = await fetch(`/api/projects/${projectId}/labels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color }),
      });
      if (!res.ok) return null;
      const label = (await res.json()) as Label;
      setLabels((prev) => (prev.some((l) => l.id === label.id) ? prev : [...prev, label]));
      return label;
    },
    [projectId]
  );

  const createTask = useCallback(
    async (input: NewTaskInput): Promise<boolean> => {
      lastMutation.current = Date.now();
      const res = await fetch(`/api/projects/${projectId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: input.title,
          content: input.content || input.title,
          type: input.type,
          internal: input.internal,
          assigneeId: input.assigneeId === undefined ? (assigneeFilter === "mine" ? currentUserId : null) : input.assigneeId,
          ...(input.statusId ? { statusId: input.statusId } : {}),
          ...(input.labelIds.length ? { labelIds: input.labelIds } : {}),
        }),
      });
      if (!res.ok) return false;
      const created = (await res.json()) as WorkspaceItem;
      setItems((prev) => [created, ...prev]);
      return true;
    },
    [projectId, assigneeFilter, currentUserId]
  );

  // ── Pending moderation ─────────────────────────────────────────────────────
  const decidePending = useCallback(
    async (id: string, approve: boolean) => {
      lastMutation.current = Date.now();
      const res = await fetch(`/api/projects/${projectId}/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: approve ? "OPEN" : "CLOSED" }),
      });
      if (!res.ok) return;
      setPending((prev) => prev.filter((f) => f.id !== id));
      if (approve) {
        const updated = (await res.json()) as WorkspaceItem;
        setItems((prev) => [updated, ...prev]);
      }
    },
    [projectId]
  );

  // ── Status catalogue mutations (shared so every view updates instantly) ────
  const applyStatusUpdate = useCallback((updated: ProjectStatus) => {
    setStatuses((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s)).sort((a, b) => a.order - b.order)
    );
    setBoards((prev) =>
      prev.map((b) => ({
        ...b,
        columns: b.columns.map((c) =>
          c.statusId === updated.id ? { ...c, status: updated } : c
        ),
      }))
    );
    setItems((prev) =>
      prev.map((f) => (f.statusId === updated.id ? { ...f, boardStatus: updated } : f))
    );
  }, []);

  const refetchBoards = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/boards`);
    if (res.ok) {
      const data = (await res.json()) as { boards: ProjectBoard[] };
      setBoards(data.boards);
    }
  }, [projectId]);

  const removeStatus = useCallback((statusId: string) => {
    setStatuses((prev) => prev.filter((s) => s.id !== statusId));
    setBoards((prev) =>
      prev.map((b) => ({ ...b, columns: b.columns.filter((c) => c.statusId !== statusId) }))
    );
    setItems((prev) =>
      prev.map((f) =>
        f.statusId === statusId ? { ...f, statusId: null, boardStatus: null } : f
      )
    );
  }, []);

  // ── Label catalogue mutations ───────────────────────────────────────────────
  const applyLabelUpdate = useCallback((updated: Label) => {
    setLabels((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    setItems((prev) =>
      prev.map((f) =>
        f.labels ? { ...f, labels: f.labels.map((l) => (l.id === updated.id ? updated : l)) } : f
      )
    );
  }, []);

  const removeLabel = useCallback((labelId: string) => {
    setLabels((prev) => prev.filter((l) => l.id !== labelId));
    setItems((prev) =>
      prev.map((f) => (f.labels ? { ...f, labels: f.labels.filter((l) => l.id !== labelId) } : f))
    );
    // Drop the id from any board's saved filters too, so a deleted label
    // can't silently keep narrowing a board forever.
    setBoards((prev) =>
      prev.map((b) => {
        if (!b.filters?.labelIds?.includes(labelId)) return b;
        return { ...b, filters: { ...b.filters, labelIds: b.filters.labelIds.filter((id) => id !== labelId) } };
      })
    );
    setLabelFilter((prev) => (prev === labelId ? null : prev));
  }, []);

  const actions: WorkspaceActions = useMemo(
    () => ({
      moveItem,
      updateItem,
      deleteItem,
      toggleItemLabel,
      createLabel,
      createTask,
      openDetail: (id) => setSelectedId(id),
      openQuickAdd: (statusId) => setQuickAdd({ open: true, statusId }),
    }),
    [moveItem, updateItem, deleteItem, toggleItemLabel, createLabel, createTask]
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  if (taskPageId) {
    const pageItem = items.find((f) => f.id === taskPageId) ?? pending.find((f) => f.id === taskPageId) ?? null;
    return (
      <main className="min-w-0 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        {pageItem ? (
          <DetailDrawer
            key={pageItem.id}
            variant="page"
            item={pageItem}
            projectId={projectId}
            statuses={statuses}
            projectLabels={labels}
            actions={actions}
            teamMembers={teamMembers}
            currentUserId={currentUserId}
            onClose={() => router.push(`/dashboard/projects/${projectId}?tab=feedback`)}
          />
        ) : (
          <div className="mx-auto max-w-md rounded-2xl border border-line bg-card p-8 text-center">
            <p className="text-sm font-semibold text-ink">This task no longer exists</p>
            <p className="mt-1 text-xs text-muted">It may have been deleted or moved to another project.</p>
            <Link href={`/dashboard/projects/${projectId}?tab=feedback`} className="mt-4 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-xs font-semibold text-primary-fg hover:bg-primary/85">Back to board</Link>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="min-w-0 px-4 py-5 sm:px-6 lg:px-7 lg:py-6 2xl:px-9">

      {tab === "feedback" && (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1 basis-56">
              <h1 className="text-[22px] font-bold tracking-[-0.02em] text-ink">{assigneeFilter === "mine" ? "My tasks" : assigneeFilter === "unassigned" ? "Unassigned tasks" : assigneeFilter === "all" ? "All tasks" : `${teamMembers.find((m) => m.id === assigneeFilter)?.name || "Teammate"}’s tasks`}</h1>
              <p className="mt-0.5 text-xs text-faint">{activeItems.length} active · {completedItems.length} completed</p>
            </div>
            <div className="relative w-full sm:w-72">
              <label className="sr-only" htmlFor="task-search">Search tasks</label>
              <input
                id="task-search"
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks"
                className="h-10 w-full rounded-xl border border-line bg-card pl-9 pr-9 text-sm text-ink placeholder:text-faint focus:border-clay/50 focus:outline-none focus:ring-4 focus:ring-clay/10"
              />
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"><SearchIcon /></span>
              {search ? (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-xs text-faint transition hover:text-ink" aria-label="Clear search">✕</button>
              ) : (
                <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-line-strong px-1.5 text-[11px] text-faint">/</kbd>
              )}
            </div>
            <button onClick={() => setQuickAdd({ open: true, statusId: null })} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg transition hover:bg-primary/85" title="New task (n)"><span className="text-base leading-none">+</span> New task</button>
          </div>

          <BoardNavigation
            boards={boards}
            activeBoardId={activeBoard?.id ?? ""}
            isOwner={canManage}
            onSelect={(boardId) => {
              setActiveBoardId(boardId);
              if (view !== "board") switchView("board");
            }}
            onCreate={() => setBoardModal("new")}
            onEdit={() => setBoardModal("edit")}
          />

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="task-assignee-filter">Show tasks</label>
            <select id="task-assignee-filter" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className={chipSelect(assigneeFilter !== "all")}>
              <option value="mine">Assignee: me</option>
              <option value="all">Assignee: anyone</option>
              <option value="unassigned">Unassigned</option>
              {teamMembers.filter((m) => m.id !== currentUserId).map((m) => <option key={m.id} value={m.id}>Assignee: {m.name || m.email}</option>)}
            </select>

            <label className="sr-only" htmlFor="task-type-filter">Type</label>
            <select id="task-type-filter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as FeedbackType | "ALL")} className={chipSelect(typeFilter !== "ALL")}>
              <option value="ALL">Type: all</option>
              {TYPES.map((t) => <option key={t} value={t}>Type: {TYPE_LABELS[t]}</option>)}
            </select>

            {labels.length > 0 && <div className="relative"><button onClick={() => setShowLabelFilter((value) => !value)} aria-expanded={showLabelFilter} className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition ${labelFilter ? "border-clay/40 bg-clay-tint text-ink" : "border-line bg-card text-muted hover:border-line-strong hover:text-ink"}`}>{labelFilter ? <><span className="h-2 w-2 rounded-full" style={{ backgroundColor: labels.find((label) => label.id === labelFilter)?.color }} />{labels.find((label) => label.id === labelFilter)?.name ?? "Label"}</> : "Label: any"}<span className="text-[9px] text-faint">▾</span></button>{showLabelFilter && <><button className="fixed inset-0 z-20 cursor-default" onClick={() => setShowLabelFilter(false)} aria-label="Close label filter" /><div className="absolute left-0 top-10 z-30 w-52 rounded-xl border border-line bg-card p-1.5 shadow-lift"><button onClick={() => { setLabelFilter(null); setShowLabelFilter(false); }} className={`flex w-full items-center rounded-lg px-2.5 py-2 text-left text-xs ${!labelFilter ? "bg-raised font-semibold text-ink" : "text-muted hover:bg-raised"}`}>Any label</button>{labels.map((label) => <button key={label.id} onClick={() => { setLabelFilter(label.id); setShowLabelFilter(false); }} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs ${labelFilter === label.id ? "bg-raised font-semibold text-ink" : "text-muted hover:bg-raised"}`}><span className="h-2 w-2 rounded-full" style={{ backgroundColor: label.color }} />{label.name}</button>)}</div></>}</div>}

            <button
              onClick={() => setSortBy(sortBy === "votes" ? "newest" : "votes")}
              className="h-9 shrink-0 rounded-lg border border-line bg-card px-3 text-xs font-medium text-muted transition hover:border-line-strong hover:text-ink"
              title="Toggle sort order"
            >
              Sort: {sortBy === "votes" ? "top voted" : "newest"}
            </button>

            <div className="ml-auto flex items-center gap-2">
              {canManage && <div className="relative"><button onClick={() => setShowCustomize((value) => !value)} aria-expanded={showCustomize} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-card px-3 text-xs font-medium text-muted transition hover:border-line-strong hover:text-ink">Customize<span className="text-[9px] text-faint">▾</span></button>{showCustomize && <><button className="fixed inset-0 z-20 cursor-default" onClick={() => setShowCustomize(false)} aria-label="Close customize menu" /><div className="absolute right-0 top-10 z-30 w-48 rounded-xl border border-line bg-card p-1.5 shadow-lift">{([["statuses", "Statuses"], ["labels", "Labels"]] as const).map(([panel, label]) => <button key={panel} onClick={() => { setShowCustomize(false); router.replace(`/dashboard/projects/${projectId}?tab=feedback&panel=${panel}`); }} className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-xs text-muted hover:bg-raised hover:text-ink">{label}</button>)}{activeBoard && <button onClick={() => { setShowCustomize(false); setBoardModal("edit"); }} className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-xs text-muted hover:bg-raised hover:text-ink">Edit this board</button>}</div></>}</div>}
              <div className="flex shrink-0 gap-0.5 rounded-lg border border-line bg-surface p-0.5">
                <ViewBtn active={view === "board"} onClick={() => switchView("board")} label="Board">
                  <BoardIcon />
                </ViewBtn>
                <ViewBtn active={view === "list"} onClick={() => switchView("list")} label="List">
                  <ListIcon />
                </ViewBtn>
              </div>
            </div>
          </div>

          {filtered.length === 0 && assigneeFilter !== "all" && <div className="mb-4 rounded-xl border border-line bg-surface p-4 text-sm text-muted">No tasks match this view. <button type="button" onClick={() => setAssigneeFilter("all")} className="text-clay hover:underline">View all tasks</button></div>}

          {view === "board" && activeBoard && !activeBoard.isDefault && activeBoard.filters && (
            <BoardFilterChips
              filters={activeBoard.filters}
              labels={labels}
              onEdit={() => setBoardModal("edit")}
            />
          )}

          {view === "board" ? (
            <BoardView
              board={activeBoard}
              items={boardFiltered}
              statuses={statuses}
              isOwner={canManage}
              teamMembers={teamMembers}
              actions={actions}
              onEditBoard={() => setBoardModal("edit")}
            />
          ) : (
            <ListView items={activeItems} statuses={statuses} actions={actions} teamMembers={teamMembers} />
          )}
        </div>
      )}

      {tab === "completed" && (
        <div>
          <SectionHeader title="Completed" description={`${completedCount} shipped or closed items`} />
          {completedItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line-strong bg-card/50 text-center py-20">
              <div className="text-2xl mb-2">✓</div>
              <p className="text-sm font-medium text-ink">No completed feedback yet</p>
              <p className="text-xs text-muted mt-1">Items moved to a done column will appear here.</p>
            </div>
          ) : (
            <ListView items={completedItems} statuses={statuses} actions={actions} teamMembers={teamMembers} />
          )}
        </div>
      )}

      {tab === "pending" && <div><SectionHeader title="Pending review" description="Approve feedback before it reaches your board" /><PendingList items={pending} onDecide={decidePending} /></div>}

      {tab === "support" && <SupportPanel key={projectId} projectId={projectId} apiKey={apiKey} baseUrl={baseUrl} teamMembers={teamMembers} currentUserId={currentUserId} isOwner={isOwner} />}

      {tab === "mcp" && (
        <div className="max-w-3xl"><SectionHeader title="MCP & agents" description="Give your coding agents controlled access to this feedback workspace" />
          <McpCard projectId={projectId} baseUrl={baseUrl} configured={mcpConfigured} isOwner={isOwner} />
        </div>
      )}

      {tab === "integrations" && (
        <div><SectionHeader title="Integrations" description="Send feedback events into the tools your team already uses" /><IntegrationsTab
          projectId={projectId}
          isOwner={canManage}
          isPro={ownerPlan === "PRO" || ownerPlan === "BUSINESS"}
          onOpenMcpTab={() => switchTab("mcp")}
        /></div>
      )}

      {tab === "settings" && (
        <div><div className="mb-5 flex items-start justify-between gap-4"><SectionHeader title="Project settings" description="API access, moderation, members, and project controls" /><SetupGuideButton projectId={projectId} apiKey={apiKey} baseUrl={baseUrl} mcpConfigured={mcpConfigured} isOwner={isOwner} defaultOpen={searchParams.get("setup") === "1"} onClose={() => router.replace(`/dashboard/projects/${projectId}?tab=settings`)} /></div><SettingsTab
          projectId={projectId}
          apiKey={apiKey}
          moderationEnabled={moderationEnabled}
          isOwner={isOwner}
          canManage={canManage}
          currentUserId={currentUserId}
          teamMembers={teamMembers}
          onTeamChange={(next) => {
            setTeamMembers(next);
            const ids = new Set(next.map((m) => m.id));
            setItems((prev) => prev.map((f) => f.assigneeId && !ids.has(f.assigneeId) ? { ...f, assigneeId: null } : f));
          }}
        /></div>
      )}

      {/* Detail drawer */}
      {selectedItem && (
        <DetailDrawer
          key={selectedItem.id}
          item={selectedItem}
          projectId={projectId}
          statuses={statuses}
          projectLabels={labels}
          actions={actions}
          teamMembers={teamMembers}
          currentUserId={currentUserId}
          onClose={() => {
            setSelectedId(null);
            if (searchParams.has("issue")) {
              const next = new URLSearchParams(searchParams.toString());
              next.delete("issue");
              router.replace(`/dashboard/projects/${projectId}?${next}`, { scroll: false });
            }
          }}
        />
      )}

      {/* New task modal */}
      {quickAdd.open && (
        <NewTaskModal
          teamMembers={teamMembers}
          defaultAssigneeId={assigneeFilter === "mine" ? currentUserId : null}
          statuses={statuses}
          labels={labels}
          presetStatusId={quickAdd.statusId}
          onCreate={createTask}
          onClose={() => setQuickAdd({ open: false, statusId: null })}
        />
      )}

      {/* New / edit board */}
      {boardModal && (
        <BoardFormModal
          projectId={projectId}
          projectSlug={projectSlug}
          baseUrl={baseUrl}
          statuses={statuses}
          labels={labels}
          board={boardModal === "edit" ? activeBoard : null}
          canDelete={!activeBoard?.isDefault}
          onSaved={(board) => {
            setBoards((prev) => {
              const exists = prev.some((b) => b.id === board.id);
              return exists ? prev.map((b) => (b.id === board.id ? board : b)) : [...prev, board];
            });
            setActiveBoardId(board.id);
            setBoardModal(null);
          }}
          onDeleted={(boardId) => {
            setBoards((prev) => {
              const next = prev.filter((b) => b.id !== boardId);
              setActiveBoardId(next.find((b) => b.isDefault)?.id ?? next[0]?.id ?? "");
              return next;
            });
            setBoardModal(null);
          }}
          onClose={() => setBoardModal(null)}
          onCreateLabel={createLabel}
        />
      )}

      {/* Manage statuses */}
      {showStatuses && (
        <ManageStatusesModal
          projectId={projectId}
          statuses={statuses}
          onCreated={(status, addedToBoards) => {
            setStatuses((prev) => [...prev, status].sort((a, b) => a.order - b.order));
            if (addedToBoards) void refetchBoards();
          }}
          onUpdated={applyStatusUpdate}
          onDeleted={removeStatus}
          onClose={closeSettingsPanel}
        />
      )}

      {/* Manage labels */}
      {showLabels && (
        <ManageLabelsModal
          projectId={projectId}
          labels={labels}
          onCreated={(label) => setLabels((prev) => (prev.some((l) => l.id === label.id) ? prev : [...prev, label]))}
          onUpdated={applyLabelUpdate}
          onDeleted={removeLabel}
          onClose={closeSettingsPanel}
        />
      )}
    </main>
  );
}

// ─── Board navigation ───────────────────────────────────────────────────────

function BoardNavigation({
  boards,
  activeBoardId,
  isOwner,
  onSelect,
  onCreate,
  onEdit,
}: {
  boards: ProjectBoard[];
  activeBoardId: string;
  isOwner: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="mb-4 flex min-w-0 items-end border-b border-line" aria-label="Boards">
      <nav className="scrollbar-none flex min-w-0 flex-1 gap-0.5 overflow-x-auto" aria-label="Choose a board">
        {boards.map((board) => {
          const active = board.id === activeBoardId;
          return (
            <button
              key={board.id}
              type="button"
              onClick={() => onSelect(board.id)}
              aria-current={active ? "page" : undefined}
              className={`group relative inline-flex h-11 shrink-0 items-center gap-2 px-3 text-[13px] transition-colors ${
                active ? "font-semibold text-ink" : "font-medium text-muted hover:text-ink"
              }`}
            >
              <span className={active ? "text-clay" : "text-faint group-hover:text-muted"}>
                {board.isDefault ? <BoardIcon /> : <BoardTabIcon />}
              </span>
              <span>{board.name}</span>
              {board.isPublic && <span className="h-1.5 w-1.5 rounded-full bg-success" title="Public board" />}
              {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-clay" />}
            </button>
          );
        })}
      </nav>

      {isOwner && (
        <div className="flex h-11 shrink-0 items-center gap-1 pl-2">
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted transition hover:bg-raised hover:text-ink"
          >
            <span className="text-base leading-none">+</span>
            <span className="hidden sm:inline">New board</span>
          </button>
          {!!activeBoardId && (
            <button
              type="button"
              onClick={onEdit}
              className="grid h-7 w-7 place-items-center rounded-md text-faint transition hover:bg-raised hover:text-ink"
              aria-label="Edit current board"
              title="Edit current board"
            >
              <SlidersIcon />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Board filter chips ─────────────────────────────────────────────────────
// Shown above a non-default board so it's obvious *why* fewer cards appear
// than on the main board, with a one-click way back into the editor.

function BoardFilterChips({
  filters,
  labels,
  onEdit,
}: {
  filters: BoardFilters;
  labels: Label[];
  onEdit: () => void;
}) {
  const labelChips = (filters.labelIds ?? [])
    .map((id) => labels.find((l) => l.id === id))
    .filter((l): l is Label => !!l);

  return (
    <div className="flex items-center gap-1.5 flex-wrap mb-3 text-xs">
      <span className="text-faint shrink-0">Filtered by</span>
      {filters.types?.map((t) => (
        <span key={t} className={`px-2 py-0.5 rounded-full font-medium border ${TYPE_COLORS[t]}`}>
          {TYPE_LABELS[t]}
        </span>
      ))}
      {labelChips.map((l) => (
        <span
          key={l.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium text-white"
          style={{ backgroundColor: l.color }}
        >
          {l.name}
        </span>
      ))}
      {filters.createdAfter && (
        <span className="px-2 py-0.5 rounded-full border border-line bg-card text-muted">
          after {new Date(filters.createdAfter).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </span>
      )}
      {filters.createdBefore && (
        <span className="px-2 py-0.5 rounded-full border border-line bg-card text-muted">
          before {new Date(filters.createdBefore).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </span>
      )}
      <button onClick={onEdit} className="text-clay hover:text-clay-hover transition font-medium ml-1">
        Edit filters
      </button>
    </div>
  );
}

// ─── Small presentational bits ────────────────────────────────────────────────

function SectionHeader({ title, description }: { title: string; description: string }) {
  return <div className="mb-5"><h1 className="text-xl font-semibold tracking-[-0.02em] text-ink">{title}</h1><p className="mt-1 text-xs text-faint">{description}</p></div>;
}

function ViewBtn({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={`${label} view`}
      aria-pressed={active}
      className={`inline-flex h-8 items-center gap-1.5 px-2.5 rounded-md text-xs font-medium transition ${
        active ? "bg-card text-ink shadow-soft" : "text-muted hover:text-ink"
      }`}
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function BoardIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <rect x="0.5" y="0.5" width="4" height="11" rx="1" stroke="currentColor" />
      <rect x="7.5" y="0.5" width="4" height="7" rx="1" stroke="currentColor" />
    </svg>
  );
}

function BoardTabIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <rect x="1" y="1" width="10" height="10" rx="2" stroke="currentColor" />
      <path d="M4.3 1v10M7.7 1v10" stroke="currentColor" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <path d="M2 3.25h9M2 9.75h9" stroke="currentColor" strokeLinecap="round" />
      <circle cx="4.5" cy="3.25" r="1.25" fill="rgb(var(--c-card))" stroke="currentColor" />
      <circle cx="8.5" cy="9.75" r="1.25" fill="rgb(var(--c-card))" stroke="currentColor" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M1 2.5h10M1 6h10M1 9.5h10" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <circle cx="5" cy="5" r="3.5" stroke="currentColor" />
      <path d="M8 8l3 3" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}
