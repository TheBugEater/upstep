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
