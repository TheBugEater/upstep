export const MCP_TASK_WORKFLOW =
  "When asked to implement or fix a task, update its status throughout the work; a final chat reply does not complete the UpStep task. " +
  "First read get_feedback and list_statuses (or get_project_overview) to identify the task and actual project columns. " +
  "Before starting implementation, call update_feedback with the task id, the project's In Progress column as status_name, and lifecycle_status=IN_PROGRESS. " +
  "For custom column names, use the existing column that represents active work; do not invent or rename columns. If the appropriate column is unclear or missing, ask the user which to use. " +
  "After the requested work and relevant validation are complete (including deployment when requested), call update_feedback with the same task id, an existing column with is_done=true as status_name, and lifecycle_status=DONE. " +
  "Check that the tool succeeded and that updated.board_column and updated.lifecycle_status confirm the intended state before reporting completion. " +
  "Then call add_comment on the same task with a concise completion note: summarize what changed, state the validation actually performed and its result, and include the verified commit SHA, pull request URL, and deployment URL when available. " +
  "Completion comments are part of this workflow unless the user explicitly requests no comments. Never invent commit IDs, links, successful tests, or deployment results; omit evidence that is unavailable. " +
  "Check that add_comment returned posted=true. If posting fails, keep the verified completion status and report that the completion comment could not be saved. Before retrying an uncertain comment request, read get_feedback to avoid posting the same completion note twice. " +
  "If work is blocked, fails validation, or remains incomplete, do not mark it done; use an existing blocked column when appropriate, otherwise leave it In Progress, and explain the blocker in your reply. " +
  "Read-only browsing or triage does not start or complete tasks. Change only tasks you are actually working on. " +
  "Comments may be customer-visible: keep completion notes suitable for that audience and exclude secrets. Other progress comments require a user request.";

export function mcpInstructions(projectName: string) {
  return `Feedback inbox and task board for the project ${JSON.stringify(projectName)}. ` +
    "Use get_project_overview first to see what's inside and list_feedback to browse by votes. " +
    MCP_TASK_WORKFLOW + " " +
    "Keep agent work internal: create_feedback defaults to internal=true (Dev-only, hidden from the public widget), " +
    "and create_board gives you a separate workspace without touching the main board. " +
    "Attach labels with create_feedback/update_feedback (they're created automatically from a name), " +
    "and give create_board a filters object (labels, type, or a creation-date range) for a board that only shows a slice of the inbox. " +
    "The main board never takes filters, it always shows everything.";
}
