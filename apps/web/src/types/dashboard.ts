import type { Feedback, Label } from "@upstep/types";

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

export interface ProjectBoard {
  id: string;
  name: string;
  isDefault: boolean;
  columns: BoardColumnDef[];
}

/** A feedback item as the dashboard workspace sees it — with board placement. */
export interface WorkspaceItem extends Feedback {
  statusId?: string | null;
  boardStatus?: ProjectStatus | null;
  labels?: Label[];
}
