import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { enforceProjectAndClientLimits, rateLimitResponse } from "@/lib/rate-limit";
import { kickNotificationProcessor, queueIntegration } from "@/lib/notification-queue";
import { authenticateMcpKey } from "@/lib/mcp-access";
import { assertProjectAssignee } from "@/lib/task-assignment";
import { CollaborationError, collaborationTransaction } from "@/lib/project-collaboration";
import { feedbackLifecycle, type TaskLifecycle } from "@/lib/feedback-lifecycle";
import { MCP_TASK_WORKFLOW, mcpInstructions } from "@/lib/mcp-workflow";

/**
 * Upstep MCP server - Streamable HTTP transport (JSON responses).
 *
 * Any MCP client (Claude Code, Codex, Claude Desktop, Cursor, …) can connect with:
 *   claude mcp add --transport http upstep https://upstep.dev/api/mcp \
 *     --header "Authorization: Bearer <project MCP key>"
 *
 *   export UPSTEP_MCP_KEY="<project MCP key>"
 *   codex mcp add upstep --url https://upstep.dev/api/mcp \
 *     --bearer-token-env-var UPSTEP_MCP_KEY
 *
 * The secret MCP key scopes every tool to a single project, so an agent can browse,
 * triage, create, and comment on feedback - nothing else.
 */

const PROTOCOL_VERSION = "2025-06-18";

/** Shape stored in Board.filters — mirrors the dashboard's BoardFilters type. */
type BoardFiltersJson = {
  labelIds?: string[];
  types?: ("BUG" | "FEATURE" | "GENERAL")[];
  createdAfter?: string;
  createdBefore?: string;
};

type Project = NonNullable<Awaited<ReturnType<typeof authenticate>>>;

async function authenticate(req: NextRequest) {
  const bearer = req.headers.get("authorization");
  const mcpKey = bearer?.replace(/^Bearer\s+/i, "").trim() ?? "";
  return authenticateMcpKey(mcpKey);
}

// ─── JSON-RPC plumbing ────────────────────────────────────────────────────────

type RpcRequest = {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
};

function rpcResult(id: RpcRequest["id"], result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, result });
}

function rpcError(id: RpcRequest["id"], code: number, message: string, status = 200) {
  return NextResponse.json(
    { jsonrpc: "2.0", id: id ?? null, error: { code, message } },
    { status }
  );
}

function toolText(payload: unknown) {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
  };
}

function toolError(message: string) {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

// ─── Tool schemas ─────────────────────────────────────────────────────────────

const listFeedbackArgs = z.object({
  status: z.enum(["PENDING", "OPEN", "IN_PROGRESS", "DONE", "CLOSED"]).optional(),
  type: z.enum(["BUG", "FEATURE", "GENERAL"]).optional(),
  search: z.string().optional(),
  assignee_id: z.string().min(1).nullable().optional(),
  sort: z.enum(["votes", "newest"]).default("votes"),
  limit: z.number().int().min(1).max(100).default(25),
});

const getFeedbackArgs = z.object({ id: z.string() });

const createFeedbackArgs = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(5000).optional(),
  type: z.enum(["BUG", "FEATURE", "GENERAL"]).default("GENERAL"),
  status_name: z.string().optional().describe("Board column to place the task in"),
  internal: z.boolean().default(true),
  assignee_id: z.string().min(1).nullable().optional(),
  labels: z.array(z.string().min(1).max(50)).max(10).optional(),
});

const updateFeedbackArgs = z.object({
  id: z.string(),
  assignee_id: z.string().min(1).nullable().optional(),
  status_name: z.string().trim().min(1).optional(),
  lifecycle_status: z.enum(["OPEN", "IN_PROGRESS", "DONE"]).optional(),
  type: z.enum(["BUG", "FEATURE", "GENERAL"]).optional(),
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(5000).optional(),
  add_labels: z.array(z.string().min(1).max(50)).max(10).optional(),
  remove_labels: z.array(z.string().min(1).max(50)).max(10).optional(),
});

const addCommentArgs = z.object({
  feedback_id: z.string(),
  content: z.string().min(1).max(2000),
  author_name: z.string().max(80).optional(),
});

const createLabelArgs = z.object({
  name: z.string().min(1).max(50),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a 6-digit hex color like #6366f1")
    .optional(),
});

const boardFiltersArgs = z
  .object({
    label_names: z.array(z.string()).max(10).optional(),
    types: z.array(z.enum(["BUG", "FEATURE", "GENERAL"])).optional(),
    created_after: z.string().optional().describe("ISO date; only tasks created on or after this date"),
    created_before: z.string().optional().describe("ISO date; only tasks created on or before this date"),
  })
  .optional();

const createBoardArgs = z.object({
  name: z.string().min(1).max(80),
  columns: z.array(z.string().min(1).max(60)).min(1).max(8),
  done_column: z.string().optional(),
  filters: boardFiltersArgs.describe(
    "Narrows what shows on this board. Omit for a board that shows everything matching its columns."
  ),
});

const TOOLS = [
  {
    name: "get_project_overview",
    description:
      "Snapshot of the project: authenticated teammate identity, team member IDs for assignment, feedback counts, board columns, top-voted open items, and the task workflow. Read this first; implementation work must move to In Progress at the start and a done column after completion.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_feedback",
    description:
      "List feedback items with votes, assignment, and board status. Personal keys default to the authenticated teammate's tasks. Use assignee_id=all for the full project, me for your tasks, or null for unassigned work. Sorted by votes by default.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["PENDING", "OPEN", "IN_PROGRESS", "DONE", "CLOSED"], description: "Filter by lifecycle status" },
        type: { type: "string", enum: ["BUG", "FEATURE", "GENERAL"], description: "Filter by feedback type" },
        search: { type: "string", description: "Full-text match against title and content" },
        assignee_id: { type: ["string", "null"], description: "Filter by teammate id, me, all, or null for unassigned. Personal keys default to me; legacy shared keys default to all." },
        sort: { type: "string", enum: ["votes", "newest"], description: "Sort order (default votes)" },
        limit: { type: "number", description: "Max items to return, 1-100 (default 25)" },
      },
    },
  },
  {
    name: "get_feedback",
    description: "Fetch one feedback item with its full content, labels, board status, comment thread, and task workflow. Read before implementing; call update_feedback to mark In Progress before work and Done after validation, then add_comment with completion evidence.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Feedback id" } },
      required: ["id"],
    },
  },
  {
    name: "create_feedback",
    description:
      "Create a feedback item or internal task. Personal keys assign it to the authenticated teammate by default; assignee_id can select another current teammate or null for unassigned. internal=true (the default) marks it Dev-only, visible on the team board and hidden from the public widget.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short title" },
        content: { type: "string", description: "Longer description (defaults to the title)" },
        type: { type: "string", enum: ["BUG", "FEATURE", "GENERAL"], description: "Item type (default GENERAL)" },
        status_name: { type: "string", description: "Name of the board column to place it in (default: first column)" },
        internal: { type: "boolean", description: "Hide from the public widget (default true)" },
        assignee_id: { type: ["string", "null"], description: "Assign to a current teammate id or me; null leaves unassigned. Personal keys default to the authenticated teammate." },
        labels: {
          type: "array",
          items: { type: "string" },
          description: "Label names to attach, up to 10. Created automatically if they don't already exist.",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "update_feedback",
    description:
      "Update a task or feedback item. REQUIRED when implementing work: before starting, set status_name to the existing active-work column and lifecycle_status to IN_PROGRESS; after completing and validating the requested work, set status_name to an is_done=true column and lifecycle_status to DONE. Verify the returned updated state, then call add_comment with a completion summary, validation results, and verified commit SHA or links when available, unless the user requested no comments. Never mark blocked or incomplete work done. Also supports editing title, content, type, and labels.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Feedback id" },
        assignee_id: { type: ["string", "null"], description: "Assign to a current teammate id or me, or null to unassign. Omit to preserve the current assignment." },
        status_name: { type: "string", description: "Existing target board column name from list_statuses; required when setting lifecycle_status" },
        lifecycle_status: { type: "string", enum: ["OPEN", "IN_PROGRESS", "DONE"], description: "Use IN_PROGRESS when starting work (including custom active-work columns), DONE only after completion and validation, or OPEN when returning to the backlog. Must agree with the target column done flag." },
        type: { type: "string", enum: ["BUG", "FEATURE", "GENERAL"] },
        title: { type: "string" },
        content: { type: "string" },
        add_labels: {
          type: "array",
          items: { type: "string" },
          description: "Label names to attach, up to 10. Created automatically if they don't already exist.",
        },
        remove_labels: {
          type: "array",
          items: { type: "string" },
          description: "Label names to remove, up to 10.",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "add_comment",
    description: "Post a comment using the authenticated teammate's identity for personal keys; author_name cannot override it. Legacy shared keys use the supplied team display name. After completing a task and verifying its Done status, leave a concise completion note with what changed, actual validation results, and verified commit or deployment links when available, unless the user requested no comments. Never invent evidence or include secrets. Verify posted=true; read get_feedback before retrying an uncertain request to avoid duplicates. Comments may be customer-visible.",
    inputSchema: {
      type: "object",
      properties: {
        feedback_id: { type: "string", description: "Feedback id" },
        content: { type: "string", description: "Comment body, up to 2000 characters. For completed tasks: summary, actual validation results, and verified commit SHA or links when available." },
        author_name: { type: "string", description: "Personal keys always use the authenticated teammate name. Legacy keys use this display name (default UpStep Team)." },
      },
      required: ["feedback_id", "content"],
    },
  },
  {
    name: "list_statuses",
    description: "List actual project columns and their done-flags. Use the existing active-work column when starting a task, and a column with is_done=true only when the work is complete. Do not invent column names.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_labels",
    description: "List the project's labels with their colors.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "create_label",
    description: "Create a new label. Most of the time you don't need this, create_feedback and update_feedback create labels automatically when you reference a name that doesn't exist yet; use this when you want a specific color.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Label name" },
        color: { type: "string", description: "Hex color like #6366f1 (default: an auto-assigned color)" },
      },
      required: ["name"],
    },
  },
  {
    name: "list_boards",
    description: "List the project's boards, their columns, and any filters a board has. The main board is marked is_default and always shows everything.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "create_board",
    description:
      "Create a separate board (e.g. an agent workspace, or a filtered view) with its own columns, keeping the main board untouched. Missing statuses are created automatically. Optionally scope it with filters so it only shows matching tasks, by label, type, or a creation-date range.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Board name, e.g. \"Agent tasks\"" },
        columns: {
          type: "array",
          items: { type: "string" },
          description: "Column names in order, e.g. [\"Backlog\", \"Doing\", \"Shipped\"]. Reuses existing statuses with the same name.",
        },
        done_column: { type: "string", description: "Which column counts as done (defaults to the last one)" },
        filters: {
          type: "object",
          properties: {
            label_names: {
              type: "array",
              items: { type: "string" },
              description: "Only show tasks with at least one of these labels. Created automatically if missing.",
            },
            types: {
              type: "array",
              items: { type: "string", enum: ["BUG", "FEATURE", "GENERAL"] },
              description: "Only show tasks of these types",
            },
            created_after: { type: "string", description: "ISO date; only tasks created on or after this date" },
            created_before: { type: "string", description: "ISO date; only tasks created on or before this date" },
          },
          description: "Omit entirely for a board that shows everything matching its columns.",
        },
      },
      required: ["name", "columns"],
    },
  },
];

// ─── Tool implementations ─────────────────────────────────────────────────────

const feedbackSelect = {
  id: true,
  title: true,
  content: true,
  type: true,
  status: true,
  upvotes: true,
  downvotes: true,
  internal: true,
  flagged: true,
  createdAt: true,
  assigneeId: true,
  assignee: { select: { name: true } },
  boardStatus: { select: { name: true, color: true, isDone: true } },
  labels: { select: { name: true } },
} as const;

function serialize(f: {
  id: string;
  title: string | null;
  content: string;
  type: string;
  status: string;
  upvotes: number;
  downvotes: number;
  internal: boolean;
  flagged: boolean;
  createdAt: Date;
  assigneeId: string | null;
  assignee: { name: string | null } | null;
  boardStatus: { name: string; isDone: boolean } | null;
  labels: { name: string }[];
}) {
  return {
    id: f.id,
    title: f.title ?? f.content.slice(0, 80),
    content: f.content,
    type: f.type,
    assignee_id: f.assigneeId,
    assignee_name: f.assignee?.name ?? null,
    board_column: f.boardStatus?.name ?? null,
    done: f.boardStatus?.isDone ?? f.status === "DONE",
    lifecycle_status: f.status,
    votes: f.upvotes - f.downvotes,
    upvotes: f.upvotes,
    internal: f.internal,
    flagged: f.flagged,
    labels: f.labels.map((l) => l.name),
    created_at: f.createdAt.toISOString(),
  };
}

async function resolveStatus(projectId: string, statusName: string) {
  const statuses = await db.status.findMany({ where: { projectId } });
  return (
    statuses.find((s) => s.name.toLowerCase() === statusName.toLowerCase()) ?? null
  );
}

const LABEL_PALETTE = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899"];

/** Finds each label by name (case-insensitive), creating any that don't
 *  exist yet. Labels are low-stakes compared to statuses, so agents can
 *  reference a new name directly instead of needing a separate create step. */
async function resolveOrCreateLabels(projectId: string, names: string[]): Promise<string[]> {
  if (names.length === 0) return [];
  const existing = await db.label.findMany({ where: { projectId } });
  const ids: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    let label = existing.find((l) => l.name.toLowerCase() === name.toLowerCase());
    if (!label) {
      label = await db.label.create({
        data: { projectId, name, color: LABEL_PALETTE[existing.length % LABEL_PALETTE.length]! },
      });
      existing.push(label);
    }
    ids.push(label.id);
  }
  return ids;
}

async function callTool(project: Project, name: string, args: Record<string, unknown>) {
  switch (name) {
    case "get_project_overview": {
      const [byStatus, byType, statuses, top, team] = await Promise.all([
        db.feedback.groupBy({ by: ["status"], _count: { id: true }, where: { projectId: project.id } }),
        db.feedback.groupBy({ by: ["type"], _count: { id: true }, where: { projectId: project.id } }),
        db.status.findMany({ where: { projectId: project.id }, orderBy: { order: "asc" } }),
        db.feedback.findMany({
          where: { projectId: project.id, status: { in: ["OPEN", "IN_PROGRESS"] } },
          orderBy: { upvotes: "desc" },
          take: 5,
          select: feedbackSelect,
        }),
        db.project.findUniqueOrThrow({ where: { id: project.id }, select: {
          owner: { select: { id: true, name: true, email: true } },
          members: { select: { role: true, user: { select: { id: true, name: true, email: true } } } },
        } }),
      ]);
      return toolText({
        project: project.name,
        current_user: project.actor,
        team_members: [
          { id: team.owner.id, name: team.owner.name?.trim() || team.owner.email, role: "OWNER" },
          ...team.members.filter((member) => member.user.id !== team.owner.id).map((member) => ({ id: member.user.id, name: member.user.name?.trim() || member.user.email, role: member.role })),
        ],
        credential_type: project.actor ? "personal" : "legacy_shared",
        task_workflow: MCP_TASK_WORKFLOW,
        moderation_enabled: project.moderationEnabled,
        counts_by_status: Object.fromEntries(byStatus.map((r) => [r.status, r._count.id])),
        counts_by_type: Object.fromEntries(byType.map((r) => [r.type, r._count.id])),
        board_columns: statuses.map((s) => ({ name: s.name, is_done: s.isDone })),
        top_voted_open: top.map(serialize),
      });
    }

    case "list_feedback": {
      const parsed = listFeedbackArgs.safeParse(args);
      if (!parsed.success) return toolError(`Invalid arguments: ${parsed.error.message}`);
      const { status, type, search, sort, limit, assignee_id } = parsed.data;
      const assignee = assignee_id === undefined ? (project.actor ? "me" : "all") : assignee_id;
      if (assignee === "me" && !project.actor) return toolError("This legacy shared key has no user identity. Use a personal project key or choose a teammate id.");
      const items = await db.feedback.findMany({
        where: {
          projectId: project.id,
          ...(assignee === "all" ? {} : { assigneeId: assignee === "me" ? project.actor!.id : assignee }),
          ...(status ? { status } : {}),
          ...(type ? { type } : {}),
          ...(search
            ? {
                OR: [
                  { title: { contains: search, mode: "insensitive" as const } },
                  { content: { contains: search, mode: "insensitive" as const } },
                ],
              }
            : {}),
        },
        orderBy: sort === "votes" ? { upvotes: "desc" } : { createdAt: "desc" },
        take: limit,
        select: feedbackSelect,
      });
      return toolText({ count: items.length, items: items.map(serialize) });
    }

    case "get_feedback": {
      const parsed = getFeedbackArgs.safeParse(args);
      if (!parsed.success) return toolError(`Invalid arguments: ${parsed.error.message}`);
      const item = await db.feedback.findFirst({
        where: { id: parsed.data.id, projectId: project.id },
        select: {
          ...feedbackSelect,
          comments: {
            orderBy: { createdAt: "asc" },
            select: { content: true, authorName: true, authorId: true, isOwner: true, createdAt: true },
          },
        },
      });
      if (!item) return toolError("Feedback not found in this project.");
      return toolText({
        ...serialize(item),
        task_workflow: MCP_TASK_WORKFLOW,
        comments: item.comments.map((c) => ({
          author: c.authorName ?? (c.isOwner ? "Team" : "User"),
          author_id: c.authorId,
          from_team: c.isOwner || !!c.authorId,
          content: c.content,
          created_at: c.createdAt.toISOString(),
        })),
      });
    }

    case "create_feedback": {
      const parsed = createFeedbackArgs.safeParse(args);
      if (!parsed.success) return toolError(`Invalid arguments: ${parsed.error.message}`);
      const { title, content, type, status_name, internal, labels, assignee_id } = parsed.data;
      if (assignee_id === "me" && !project.actor) return toolError("Use a personal key to assign work to me.");
      const assigneeId = assignee_id === "me" ? project.actor!.id : assignee_id === undefined ? project.actor?.id ?? null : assignee_id;

      let boardStatus = status_name ? await resolveStatus(project.id, status_name) : null;
      if (status_name && !boardStatus) {
        return toolError(
          `No board column named "${status_name}". Use list_statuses to see available columns.`
        );
      }
      if (!boardStatus) {
        boardStatus = await db.status.findFirst({
          where: { projectId: project.id, isDone: false },
          orderBy: { order: "asc" },
        });
      }

      const labelIds = await resolveOrCreateLabels(project.id, labels ?? []);

      const created = await collaborationTransaction(async (tx) => {
        await assertProjectAssignee(project.id, assigneeId, tx);
        return tx.feedback.create({
          data: {
            projectId: project.id,
            title,
            content: content || title,
            type,
            internal,
            assigneeId,
            status: boardStatus ? feedbackLifecycle(boardStatus) : "OPEN",
            statusId: boardStatus?.id ?? null,
            ...(labelIds.length ? { labels: { connect: labelIds.map((id) => ({ id })) } } : {}),
          },
          select: feedbackSelect,
        });
      });

      await queueIntegration({
        event: "NEW_FEEDBACK",
        project: { id: project.id, name: project.name },
        feedback: { id: created.id, title, content: content || title, type },
      });
      kickNotificationProcessor();

      return toolText({ created: serialize(created) });
    }

    case "update_feedback": {
      const parsed = updateFeedbackArgs.safeParse(args);
      if (!parsed.success) return toolError(`Invalid arguments: ${parsed.error.message}`);
      const { id, status_name, lifecycle_status, type, title, content, add_labels, remove_labels, assignee_id } = parsed.data;
      if (assignee_id === "me" && !project.actor) return toolError("Use a personal key to assign work to me.");
      const assigneeId = assignee_id === "me" ? project.actor!.id : assignee_id;
      if (lifecycle_status && !status_name) {
        return toolError("status_name is required with lifecycle_status. Use list_statuses to choose an existing column.");
      }

      const existing = await db.feedback.findFirst({ where: { id, projectId: project.id }, include: { boardStatus: { select: { name: true, color: true } } } });
      if (!existing) return toolError("Feedback not found in this project.");

      let statusPatch: { statusId: string; status: TaskLifecycle } | null = null;
      if (status_name) {
        const target = await resolveStatus(project.id, status_name);
        if (!target) {
          return toolError(
            `No board column named "${status_name}". Use list_statuses to see available columns.`
          );
        }
        try {
          statusPatch = { statusId: target.id, status: feedbackLifecycle(target, lifecycle_status) };
        } catch (error) {
          return toolError(error instanceof Error ? error.message : "Invalid lifecycle status.");
        }
      }

      const addLabelIds = await resolveOrCreateLabels(project.id, add_labels ?? []);
      let removeLabelIds: string[] = [];
      if (remove_labels?.length) {
        const toRemove = await db.label.findMany({
          where: { projectId: project.id, name: { in: remove_labels, mode: "insensitive" } },
          select: { id: true },
        });
        removeLabelIds = toRemove.map((l) => l.id);
      }
      const labelsPatch: { connect?: { id: string }[]; disconnect?: { id: string }[] } = {};
      if (addLabelIds.length) labelsPatch.connect = addLabelIds.map((id) => ({ id }));
      if (removeLabelIds.length) labelsPatch.disconnect = removeLabelIds.map((id) => ({ id }));

      const updated = await collaborationTransaction(async (tx) => {
        await assertProjectAssignee(project.id, assigneeId, tx);
        return tx.feedback.update({
          where: { id },
          data: {
            ...(statusPatch ?? {}),
            ...(assigneeId !== undefined ? { assigneeId } : {}),
            ...(type ? { type } : {}),
            ...(title ? { title } : {}),
            ...(content ? { content } : {}),
            ...(Object.keys(labelsPatch).length ? { labels: labelsPatch } : {}),
          },
          select: feedbackSelect,
        });
      });

      if (statusPatch && (statusPatch.status !== existing.status || statusPatch.statusId !== existing.statusId)) {
        await queueIntegration({
          event: "STATUS_CHANGED",
          project: { id: project.id, name: project.name },
          feedback: { id, title: existing.title, content: existing.content, type: existing.type },
          oldStatus: existing.status,
          newStatus: statusPatch.status,
          ...(existing.boardStatus ? { oldStatusName: existing.boardStatus.name, oldStatusColor: existing.boardStatus.color } : {}),
          ...(updated.boardStatus ? { newStatusName: updated.boardStatus.name, newStatusColor: updated.boardStatus.color } : {}),
        });
        kickNotificationProcessor();
      }

      return toolText({ updated: serialize(updated) });
    }

    case "add_comment": {
      const parsed = addCommentArgs.safeParse(args);
      if (!parsed.success) return toolError(`Invalid arguments: ${parsed.error.message}`);
      const { feedback_id, content, author_name } = parsed.data;

      const feedback = await db.feedback.findFirst({
        where: { id: feedback_id, projectId: project.id },
      });
      if (!feedback) return toolError("Feedback not found in this project.");

      const comment = await db.comment.create({
        data: {
          feedbackId: feedback_id,
          content,
          authorName: project.actor?.name ?? (author_name?.trim() || "UpStep Team"),
          authorId: project.actor?.id ?? null,
          isOwner: project.actor?.isOwner ?? true,
        },
      });

      await queueIntegration({
        event: "NEW_COMMENT",
        project: { id: project.id, name: project.name },
        feedback: { id: feedback.id, title: feedback.title, content: feedback.content, type: feedback.type },
        comment: { content, authorName: comment.authorName },
      });
      kickNotificationProcessor();

      return toolText({ posted: true, comment_id: comment.id });
    }

    case "list_statuses": {
      const statuses = await db.status.findMany({
        where: { projectId: project.id },
        orderBy: { order: "asc" },
        include: { _count: { select: { feedbacks: true } } },
      });
      return toolText(
        statuses.map((s) => ({
          name: s.name,
          color: s.color,
          is_done: s.isDone,
          item_count: s._count.feedbacks,
        }))
      );
    }

    case "list_labels": {
      const labels = await db.label.findMany({
        where: { projectId: project.id },
        orderBy: { name: "asc" },
      });
      return toolText(labels.map((l) => ({ name: l.name, color: l.color })));
    }

    case "create_label": {
      const parsed = createLabelArgs.safeParse(args);
      if (!parsed.success) return toolError(`Invalid arguments: ${parsed.error.message}`);
      const existing = await db.label.findFirst({
        where: { projectId: project.id, name: { equals: parsed.data.name, mode: "insensitive" } },
      });
      if (existing) return toolError(`A label named "${parsed.data.name}" already exists.`);
      const label = await db.label.create({
        data: {
          projectId: project.id,
          name: parsed.data.name,
          color: parsed.data.color ?? LABEL_PALETTE[0]!,
        },
      });
      return toolText({ created: { name: label.name, color: label.color } });
    }

    case "list_boards": {
      const boards = await db.board.findMany({
        where: { projectId: project.id },
        orderBy: { createdAt: "asc" },
        include: {
          columns: { orderBy: { order: "asc" }, include: { status: true } },
        },
      });
      const labelIds = boards.flatMap((b) => (b.filters as BoardFiltersJson | null)?.labelIds ?? []);
      const labelsById = labelIds.length
        ? new Map((await db.label.findMany({ where: { id: { in: labelIds } } })).map((l) => [l.id, l.name]))
        : new Map<string, string>();

      return toolText(
        boards.map((b) => {
          const f = b.filters as BoardFiltersJson | null;
          return {
            name: b.name,
            is_default: b.isDefault,
            columns: b.columns.map((c) => ({ name: c.status.name, is_done: c.status.isDone })),
            filters: f
              ? {
                  label_names: (f.labelIds ?? []).map((id) => labelsById.get(id)).filter(Boolean),
                  types: f.types ?? [],
                  created_after: f.createdAfter ?? null,
                  created_before: f.createdBefore ?? null,
                }
              : null,
          };
        })
      );
    }

    case "create_board": {
      if (!project.canManage) return toolError("Only project owners and admins can create boards and columns.");
      const parsed = createBoardArgs.safeParse(args);
      if (!parsed.success) return toolError(`Invalid arguments: ${parsed.error.message}`);
      const { name, columns, done_column, filters } = parsed.data;

      const existingBoard = await db.board.findFirst({
        where: { projectId: project.id, name: { equals: name, mode: "insensitive" } },
      });
      if (existingBoard) return toolError(`A board named "${name}" already exists.`);

      const doneName = (done_column ?? columns[columns.length - 1]!).toLowerCase();
      const statuses = await db.status.findMany({ where: { projectId: project.id } });
      const maxOrder = statuses.reduce((n, s) => Math.max(n, s.order), 0);
      const palette = ["#94a3b8", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899", "#22c55e"];

      const columnStatusIds: string[] = [];
      for (const [i, colName] of columns.entries()) {
        let status = statuses.find((s) => s.name.toLowerCase() === colName.toLowerCase());
        if (!status) {
          status = await db.status.create({
            data: {
              projectId: project.id,
              name: colName,
              color: palette[i % palette.length]!,
              order: maxOrder + i + 1,
              isDone: colName.toLowerCase() === doneName,
            },
          });
        }
        columnStatusIds.push(status.id);
      }

      const filterLabelIds = await resolveOrCreateLabels(project.id, filters?.label_names ?? []);
      const filtersJson: BoardFiltersJson = {};
      if (filterLabelIds.length) filtersJson.labelIds = filterLabelIds;
      if (filters?.types?.length) filtersJson.types = filters.types;
      if (filters?.created_after) filtersJson.createdAfter = filters.created_after;
      if (filters?.created_before) filtersJson.createdBefore = filters.created_before;
      const hasFilters = Object.keys(filtersJson).length > 0;

      const board = await db.board.create({
        data: {
          projectId: project.id,
          name,
          isDefault: false,
          ...(hasFilters ? { filters: filtersJson } : {}),
          columns: {
            create: columnStatusIds.map((statusId, order) => ({ statusId, order })),
          },
        },
        include: { columns: { orderBy: { order: "asc" }, include: { status: true } } },
      });

      return toolText({
        created_board: {
          name: board.name,
          is_default: false,
          columns: board.columns.map((c) => ({ name: c.status.name, is_done: c.status.isDone })),
          filters: hasFilters ? filters : null,
        },
        note: "The main board is untouched. Use create_feedback with internal=true and a status_name from this board to keep agent work off the public widget.",
      });
    }

    default:
      return toolError(`Unknown tool: ${name}`);
  }
}

// ─── HTTP handlers ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const project = await authenticate(req);
  if (!project) {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unauthorized: pass an active personal project MCP key as a Bearer token" } },
      { status: 401, headers: { "WWW-Authenticate": "Bearer" } }
    );
  }

  const limited = await enforceProjectAndClientLimits(req, project.id, "mcp", {
    project: 2_000,
    client: 120,
    ...(project.actor ? { clientIdentifier: `user:${project.id}:${project.actor.id}` } : {}),
  });
  if (limited) return rateLimitResponse(limited);

  let msg: RpcRequest;
  try {
    msg = (await req.json()) as RpcRequest;
  } catch {
    return rpcError(null, -32700, "Parse error", 400);
  }

  // Notifications need no response body
  if (msg.method?.startsWith("notifications/")) {
    return new NextResponse(null, { status: 202 });
  }

  switch (msg.method) {
    case "initialize":
      return rpcResult(msg.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: {
          name: "upstep",
          title: `Upstep | ${project.name}`,
          version: "1.2.0",
        },
        instructions: mcpInstructions(project.name, project.actor),
      });

    case "ping":
      return rpcResult(msg.id, {});

    case "tools/list":
      return rpcResult(msg.id, { tools: project.canManage ? TOOLS : TOOLS.filter((tool) => tool.name !== "create_board") });

    case "tools/call": {
      const name = (msg.params?.name as string) ?? "";
      const args = (msg.params?.arguments as Record<string, unknown>) ?? {};
      try {
        const result = await callTool(project, name, args);
        return rpcResult(msg.id, result);
      } catch (err) {
        if (err instanceof CollaborationError) return rpcResult(msg.id, toolError(err.message));
        console.error("[mcp] tool call failed:", err);
        return rpcResult(msg.id, toolError("Internal error while running the tool."));
      }
    }

    default:
      return rpcError(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}

// Streamable HTTP allows servers to skip the SSE channel entirely; clients
// that probe with GET get a clean 405 per spec.
export function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST, DELETE" } });
}

// Session teardown - we're stateless, so acknowledge and move on.
export function DELETE() {
  return new NextResponse(null, { status: 200 });
}
