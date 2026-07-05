import type { Feedback, FeedbackType, Label } from "@upstep/types";

export interface ProjectStatus {
  id: string;
  name: string;
  color: string;
  order: number;
  isDone: boolean;
}

export interface BoardColumnDef {
  id: string;
  statusId: string;
  order: number;
  status: ProjectStatus;
}

/** Saved filter for a non-default board. The main board ignores this and
 *  always shows everything. */
export interface BoardFilters {
  labelIds?: string[];
  types?: FeedbackType[];
  createdAfter?: string; // ISO date
  createdBefore?: string; // ISO date
}

export interface ProjectBoard {
  id: string;
  name: string;
  isDefault: boolean;
  filters?: BoardFilters | null;
  columns: BoardColumnDef[];
}

/** A feedback item as the dashboard workspace sees it - with board placement. */
export interface WorkspaceItem extends Feedback {
  statusId?: string | null;
  boardStatus?: ProjectStatus | null;
  labels?: Label[];
}
