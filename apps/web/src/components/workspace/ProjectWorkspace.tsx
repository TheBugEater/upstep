"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FeedbackType, Label } from "@upstep/types";
import type { BoardFilters, ProjectBoard, ProjectStatus, WorkspaceItem } from "@/types/dashboard";
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

type Tab = "feedback" | "completed" | "pending" | "mcp" | "integrations" | "settings";
type View = "board" | "list";
type SortMode = "newest" | "votes";

export interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  role: "OWNER" | "MEMBER";
}

export interface NewTaskInput {
  title: string;
  content: string;
  type: FeedbackType;
  statusId: string | null;
  labelIds: string[];
  internal: boolean;
}

/** Everything child views need to mutate workspace state. */
export interface WorkspaceActions {
  moveItem: (id: string, statusId: string) => void;
  updateItem: (id: string, patch: Record<string, unknown>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  toggleItemLabel: (id: string, label: Label, has: boolean) => Promise<void>;
  createLabel: (name: string, color: string) => Promise<Label | null>;
  createTask: (input: NewTaskInput) => Promise<boolean>;
  openDetail: (id: string) => void;
  openQuickAdd: (statusId: string | null) => void;
}

interface Props {
  projectName: string;
  projectId: string;
  projectSlug: string;
  apiKey: string;
  baseUrl: string;
  moderationEnabled: boolean;
  isOwner: boolean;
  ownerPlan: string;
  teamMembers: TeamMember[];
  initialItems: WorkspaceItem[];
  initialPending: WorkspaceItem[];
  initialBoards: ProjectBoard[];
  initialStatuses: ProjectStatus[];
  initialLabels: Label[];
}

export function ProjectWorkspace({
  projectName,
  projectId,
  projectSlug,
  apiKey,
  baseUrl,
  moderationEnabled,
  isOwner,
  ownerPlan,
  teamMembers,
  initialItems,
  initialPending,
  initialBoards,
  initialStatuses,
  initialLabels,
}: Props) {
  // ── Shared data state (single source of truth for the whole page) ─────────
  const [items, setItems] = useState<WorkspaceItem[]>(initialItems);
  const [pending, setPending] = useState<WorkspaceItem[]>(initialPending);
  const [boards, setBoards] = useState<ProjectBoard[]>(initialBoards);
  const [statuses, setStatuses] = useState<ProjectStatus[]>(initialStatuses);
  const [labels, setLabels] = useState<Label[]>(initialLabels);

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

  const searchRef = useRef<HTMLInputElement>(null);
  // Suppress background refresh right after an optimistic mutation so a
  // stale in-flight poll can't briefly revert what the user just did.
  const lastMutation = useRef(0);

  // Restore the preferred layout per project
  useEffect(() => {
    const saved = localStorage.getItem(`upstep:view:${projectId}`);
    if (saved === "list" || saved === "board") setView(saved);
  }, [projectId]);

  // Deep links like /dashboard/projects/[id]?tab=mcp (used by the
  // "Connect AI" quick action on the apps page)
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "mcp" || t === "integrations" || t === "settings" || t === "pending" || t === "completed") {
      setTab(t);
    }
  }, []);

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
    if (labelFilter) result = result.filter((f) => f.labels?.some((l) => l.id === labelFilter));
    return [...result].sort((a, b) =>
      sortBy === "votes"
        ? b.upvotes - a.upvotes
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [items, search, typeFilter, labelFilter, sortBy]);

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

  const selectedItem = items.find((f) => f.id === selectedId) ?? null;

  // ── Background refresh: poll + on window focus ────────────────────────────
  const refresh = useCallback(async () => {
    if (Date.now() - lastMutation.current < 5_000) return;
    try {
      const res = await fetch(
        `/api/projects/${projectId}/feedback?status=OPEN,IN_PROGRESS,DONE,PENDING&take=300`
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
      }
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
          ...(input.statusId ? { statusId: input.statusId } : {}),
          ...(input.labelIds.length ? { labelIds: input.labelIds } : {}),
        }),
      });
      if (!res.ok) return false;
      const created = (await res.json()) as WorkspaceItem;
      setItems((prev) => [created, ...prev]);
      return true;
    },
    [projectId]
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
  return (
    <div className="lg:grid lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-6">
      {/* Workspace navigation: a rail on desktop, compact tabs on mobile. */}
      <aside className="lg:sticky lg:top-20 lg:self-start mb-4 lg:mb-0">
      <div className="relative lg:rounded-2xl lg:border lg:border-line lg:bg-card lg:p-2 lg:shadow-soft">
        <div className="absolute inset-x-0 bottom-0 border-b border-line" />
        <div className="overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 lg:overflow-visible">
          <div className="flex items-center gap-1 min-w-max lg:min-w-0 lg:flex-col lg:items-stretch">
            <TabBtn active={tab === "feedback"} onClick={() => setTab("feedback")}>
              Feedback
              <Badge count={activeCount} cls="bg-clay/15 text-clay" />
            </TabBtn>
            <TabBtn active={tab === "completed"} onClick={() => setTab("completed")}>
              Completed
              <Badge count={completedCount} cls="bg-success/15 text-success" />
            </TabBtn>
            <TabBtn active={tab === "pending"} onClick={() => setTab("pending")}>
              <span className="hidden sm:inline">Pending review</span>
              <span className="sm:hidden">Pending</span>
              <Badge count={pending.length} cls="bg-clay text-white" />
            </TabBtn>
            <TabBtn active={tab === "mcp"} onClick={() => setTab("mcp")}>
              <span className="text-clay">✦</span> MCP
            </TabBtn>
            <TabBtn active={tab === "integrations"} onClick={() => setTab("integrations")}>
              Integrations
            </TabBtn>
            <TabBtn active={tab === "settings"} onClick={() => setTab("settings")}>
              Settings
            </TabBtn>
          </div>
        </div>
      </div>
      {isOwner && (
        <div className="hidden lg:block mt-3 rounded-2xl border border-line bg-card p-3 shadow-soft">
          <SetupGuideButton apiKey={apiKey} baseUrl={baseUrl} sidebar />
          <div className="border-t border-line my-2" />
          <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-faint">Manage board</p>
          <SideAction onClick={() => setShowStatuses(true)}>Statuses</SideAction>
          <SideAction onClick={() => setShowLabels(true)}>Labels</SideAction>
          <SideAction onClick={() => setBoardModal("new")}>New board</SideAction>
          {activeBoard && view === "board" && (
            <SideAction onClick={() => setBoardModal("edit")}>Edit current board</SideAction>
          )}
        </div>
      )}
      </aside>

      <main className="min-w-0">

      {tab === "feedback" && (
        <div>
          {/* Project name and board switcher share one compact header. */}
          <div className="flex items-center gap-3 mb-3 min-w-0">
            <h1 className="font-serif text-xl sm:text-2xl tracking-tight text-ink truncate shrink-0 max-w-[38%]">
              {projectName}
            </h1>
            <span className="h-5 w-px bg-line shrink-0" />
            <div className="flex items-center gap-1 min-w-0 overflow-x-auto scrollbar-none">
              {boards.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setActiveBoardId(b.id)}
                  className={`shrink-0 text-xs px-3 py-1.5 rounded-full font-medium border transition ${
                    b.id === (activeBoard?.id ?? "")
                      ? "bg-primary text-primary-fg border-ink"
                      : "bg-card text-muted border-line hover:border-line-strong hover:text-ink"
                  }`}
                >
                  {b.isDefault && <span className="mr-1 text-clay">★</span>}
                  {b.name}
                </button>
              ))}
            </div>
            {isOwner && (
              <div className="flex lg:hidden items-center gap-2 ml-auto shrink-0">
                {activeBoard && view === "board" && (
                  <button
                    onClick={() => setBoardModal("edit")}
                    className="text-xs text-muted hover:text-ink transition"
                  >
                    Edit board
                  </button>
                )}
                <button
                  onClick={() => setShowStatuses(true)}
                  className="text-xs text-muted hover:text-ink transition"
                >
                  Statuses
                </button>
                <button
                  onClick={() => setShowLabels(true)}
                  className="text-xs text-muted hover:text-ink transition"
                >
                  Labels
                </button>
                <button
                  onClick={() => setBoardModal("new")}
                  className="text-xs px-3 py-1.5 rounded-full font-medium border border-line bg-card text-muted hover:border-clay hover:text-clay transition"
                >
                  + New board
                </button>
              </div>
            )}
          </div>

          {/* Toolbar: view toggle · search · filters · sort · new task */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="flex gap-0.5 bg-card border border-line rounded-xl p-0.5 shrink-0">
              <ViewBtn active={view === "board"} onClick={() => switchView("board")} label="Board">
                <BoardIcon />
              </ViewBtn>
              <ViewBtn active={view === "list"} onClick={() => switchView("list")} label="List">
                <ListIcon />
              </ViewBtn>
            </div>

            <div className="relative flex-1 min-w-[140px] max-w-xs">
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…  ( / )"
                className="w-full text-xs rounded-xl border border-line bg-card pl-8 pr-7 py-2 text-ink placeholder:text-faint focus:outline-none focus:border-clay/40 transition"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none">
                <SearchIcon />
              </span>
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-faint hover:text-ink transition text-xs"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex gap-0.5 bg-card border border-line rounded-xl p-0.5 shrink-0">
              <FilterBtn active={typeFilter === "ALL"} onClick={() => setTypeFilter("ALL")}>
                All
              </FilterBtn>
              {TYPES.map((t) => (
                <FilterBtn
                  key={t}
                  active={typeFilter === t}
                  onClick={() => setTypeFilter(typeFilter === t ? "ALL" : t)}
                >
                  {TYPE_LABELS[t]}
                </FilterBtn>
              ))}
            </div>

            {labels.length > 0 && (
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none max-w-full" aria-label="Filter by label">
                <button onClick={() => setLabelFilter(null)} className={`shrink-0 text-xs px-2.5 py-1.5 rounded-full border transition ${!labelFilter ? "bg-primary text-primary-fg border-primary" : "bg-card text-muted border-line hover:text-ink"}`}>All labels</button>
                {labels.map((l) => (
                  <button key={l.id} onClick={() => setLabelFilter(labelFilter === l.id ? null : l.id)} className={`shrink-0 inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border font-medium transition ${labelFilter === l.id ? "text-ink border-line-strong shadow-soft" : "bg-card text-muted border-line hover:text-ink"}`} style={labelFilter === l.id ? { backgroundColor: `${l.color}20`, borderColor: `${l.color}80` } : undefined}>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />{l.name}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => setSortBy(sortBy === "votes" ? "newest" : "votes")}
              className="text-xs px-3 py-2 rounded-xl border border-line bg-card text-muted hover:text-ink transition shrink-0"
              title="Toggle sort order"
            >
              {sortBy === "votes" ? "↑ Top voted" : "↑ Newest"}
            </button>

            <button
              onClick={() => setQuickAdd({ open: true, statusId: null })}
              className="ml-auto shrink-0 px-3.5 py-2 rounded-xl bg-clay text-white text-xs font-semibold hover:bg-clay-hover transition shadow-soft"
              title="New task (n)"
            >
              + New task
            </button>
          </div>

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
              isOwner={isOwner}
              actions={actions}
              onEditBoard={() => setBoardModal("edit")}
            />
          ) : (
            <ListView items={activeItems} statuses={statuses} actions={actions} />
          )}
        </div>
      )}

      {tab === "completed" && (
        <div>
          {completedItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line-strong bg-card/50 text-center py-20">
              <div className="text-2xl mb-2">✓</div>
              <p className="text-sm font-medium text-ink">No completed feedback yet</p>
              <p className="text-xs text-muted mt-1">Items moved to a done column will appear here.</p>
            </div>
          ) : (
            <ListView items={completedItems} statuses={statuses} actions={actions} />
          )}
        </div>
      )}

      {tab === "pending" && <PendingList items={pending} onDecide={decidePending} />}

      {tab === "mcp" && (
        <div className="max-w-2xl">
          <McpCard apiKey={apiKey} baseUrl={baseUrl} />
        </div>
      )}

      {tab === "integrations" && (
        <IntegrationsTab
          projectId={projectId}
          isOwner={isOwner}
          isPro={ownerPlan === "PRO" || ownerPlan === "BUSINESS"}
          onOpenMcpTab={() => setTab("mcp")}
        />
      )}

      {tab === "settings" && (
        <SettingsTab
          projectId={projectId}
          apiKey={apiKey}
          moderationEnabled={moderationEnabled}
          isOwner={isOwner}
          teamMembers={teamMembers}
        />
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
          onClose={() => setSelectedId(null)}
        />
      )}

      {/* New task modal */}
      {quickAdd.open && (
        <NewTaskModal
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
          onClose={() => setShowStatuses(false)}
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
          onClose={() => setShowLabels(false)}
        />
      )}
      </main>
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

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-4 py-2.5 text-sm font-medium border-b-2 lg:border-b-0 lg:border-l-2 lg:rounded-lg transition ${
        active
          ? "border-clay text-clay lg:bg-clay/10"
          : "border-transparent text-muted hover:text-ink hover:border-line-strong lg:hover:bg-surface"
      }`}
    >
      {children}
    </button>
  );
}

function SideAction({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="w-full text-left px-2 py-2 rounded-lg text-xs font-medium text-muted hover:text-ink hover:bg-surface transition">
      {children}
    </button>
  );
}

function Badge({ count, cls }: { count: number; cls: string }) {
  if (count === 0) return null;
  return (
    <span
      className={`ml-1.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[9px] font-bold ${cls}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
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
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-medium transition ${
        active ? "bg-primary text-primary-fg" : "text-muted hover:text-ink"
      }`}
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function FilterBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1.5 rounded-[10px] text-xs font-medium transition ${
        active ? "bg-primary text-primary-fg" : "text-muted hover:text-ink"
      }`}
    >
      {children}
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
