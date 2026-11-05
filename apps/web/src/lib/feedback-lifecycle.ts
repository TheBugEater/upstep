export type TaskLifecycle = "OPEN" | "IN_PROGRESS" | "DONE";

/** Keep the board column and the lifecycle used by API filters consistent. */
export function feedbackLifecycle(
  column: { name: string; isDone: boolean },
  requested?: TaskLifecycle,
): TaskLifecycle {
  if (requested && (requested === "DONE") !== column.isDone) {
    throw new Error("lifecycle_status must be DONE for a done column, and OPEN or IN_PROGRESS for a non-done column.");
  }
  if (column.isDone) return "DONE";
  if (requested) return requested;
  return column.name.trim().toLowerCase().replace(/[\s_-]+/g, " ") === "in progress"
    ? "IN_PROGRESS"
    : "OPEN";
}
