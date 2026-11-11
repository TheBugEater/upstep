import { renderProjectWorkspace } from "../../workspace";

export default async function TaskPage({ params }: { params: Promise<{ id: string; taskId: string }> }) {
  const { id, taskId } = await params;
  // Passing the task as `issue` loads it even when it falls outside the
  // board's initial result limit.
  return renderProjectWorkspace({ id, issue: taskId, taskPageId: taskId });
}
