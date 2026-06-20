"use client";

import { useState } from "react";
import type { Feedback } from "@upstep/types";
import { FeedbackTable } from "@/components/FeedbackTable";
import { FeedbackBoard } from "@/components/FeedbackBoard";
import { PendingTab } from "@/components/dashboard/PendingTab";
import { SettingsTab } from "@/components/dashboard/SettingsTab";

type Tab = "feedback" | "completed" | "pending" | "settings";
type FeedbackView = "list" | "board";

interface Props {
  projectId: string;
  apiKey: string;
  moderationEnabled: boolean;
  /** Active items (OPEN + IN_PROGRESS) for the main list view. */
  listFeedback: Feedback[];
  /** Full active set (non-pending) for the board. */
  boardFeedback: Feedback[];
  /** Pending items for the moderation tab. */
  pendingFeedback: Feedback[];
  /** Resolved (DONE) items for the Completed tab. */
  completedFeedback: Feedback[];
  pendingCount: number;
  currentType: string | undefined;
  currentSort: string | undefined;
}

export function ProjectTabs({
  projectId,
  apiKey,
  moderationEnabled,
  listFeedback,
  boardFeedback,
  pendingFeedback,
  completedFeedback,
  pendingCount,
  currentType,
  currentSort,
}: Props) {
  const [tab, setTab] = useState<Tab>("feedback");
  const [view, setView] = useState<FeedbackView>("list");

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-line mb-6">
        <TabBtn active={tab === "feedback"} onClick={() => setTab("feedback")}>
          Feedback
        </TabBtn>
        <TabBtn active={tab === "completed"} onClick={() => setTab("completed")}>
          Completed
          {completedFeedback.length > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-green-100 text-green-700 text-[9px] font-bold">
              {completedFeedback.length > 99 ? "99+" : completedFeedback.length}
            </span>
          )}
        </TabBtn>
        <TabBtn active={tab === "pending"} onClick={() => setTab("pending")}>
          Pending review
          {pendingCount > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-orange-500 text-white text-[9px] font-bold">
              {pendingCount > 99 ? "99+" : pendingCount}
            </span>
          )}
        </TabBtn>
        <TabBtn active={tab === "settings"} onClick={() => setTab("settings")}>
          Settings
        </TabBtn>
      </div>

      {/* Feedback tab — active items (Open + In progress) */}
      {tab === "feedback" && (
        <div>
          <div className="flex items-center justify-between mb-5">
            <div className="inline-flex gap-1 bg-card border border-line rounded-xl p-1">
              <ViewBtn active={view === "list"} onClick={() => setView("list")}>
                ☰ List
              </ViewBtn>
              <ViewBtn active={view === "board"} onClick={() => setView("board")}>
                ▦ Board
              </ViewBtn>
            </div>
            {view === "board" && (
              <span className="text-xs text-faint hidden sm:block">
                Drag cards between columns to change status
              </span>
            )}
          </div>

          {view === "list" ? (
            <FeedbackTable
              projectId={projectId}
              feedback={listFeedback}
              currentType={currentType}
              currentStatus={undefined}
              currentSort={currentSort}
            />
          ) : (
            <FeedbackBoard projectId={projectId} feedback={boardFeedback} />
          )}
        </div>
      )}

      {/* Completed tab — DONE items */}
      {tab === "completed" && (
        <div>
          {completedFeedback.length === 0 ? (
            <div className="text-center py-16 text-muted">
              <p className="text-3xl mb-3">✓</p>
              <p className="text-sm font-medium">No completed feedback yet</p>
              <p className="text-xs text-faint mt-1">
                Items moved to Done will appear here.
              </p>
            </div>
          ) : (
            <FeedbackTable
              projectId={projectId}
              feedback={completedFeedback}
              currentType={currentType}
              currentStatus="DONE"
              currentSort={currentSort}
            />
          )}
        </div>
      )}

      {/* Pending review tab */}
      {tab === "pending" && (
        <PendingTab projectId={projectId} initialItems={pendingFeedback} />
      )}

      {/* Settings tab */}
      {tab === "settings" && (
        <SettingsTab
          projectId={projectId}
          apiKey={apiKey}
          moderationEnabled={moderationEnabled}
        />
      )}
    </div>
  );
}

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
      className={`inline-flex items-center gap-1 px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
        active
          ? "border-clay text-clay"
          : "border-transparent text-muted hover:text-ink hover:border-line-strong"
      }`}
    >
      {children}
    </button>
  );
}

function ViewBtn({
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
      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
        active ? "bg-ink text-white" : "text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
