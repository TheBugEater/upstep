import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { enforceProjectAndClientLimits, rateLimitResponse } from "@/lib/rate-limit";
import { kickNotificationProcessor, queueIntegration } from "@/lib/notification-queue";

/**
 * Upstep MCP server - Streamable HTTP transport (JSON responses).
 *
 * Any MCP client (Claude Code, Codex, Claude Desktop, Cursor, …) can connect with:
 *   claude mcp add --transport http upstep https://upstep.dev/api/mcp \
 *     --header "Authorization: Bearer <project API key>"
 *
 *   export UPSTEP_API_KEY="<project API key>"
 *   codex mcp add upstep --url https://upstep.dev/api/mcp \
 *     --bearer-token-env-var UPSTEP_API_KEY
 *
 * The API key scopes every tool to a single project, so an agent can browse,
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
  const apiKey =
    bearer?.replace(/^Bearer\s+/i, "").trim() || req.headers.get("x-api-key") || "";
  if (!apiKey) return null;
  return db.project.findUnique({
    where: { apiKey },
    select: { id: true, name: true, moderationEnabled: true },
  });
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
  labels: z.array(z.string().min(1).max(50)).max(10).optional(),
});

const updateFeedbackArgs = z.object({
  id: z.string(),
  status_name: z.string().optional(),
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
      "Snapshot of the project: feedback counts by status and type, board columns, and the top-voted open items.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_feedback",
    description:
      "List feedback items (bugs, feature requests, general) with votes and board status. Sorted by votes by default.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["PENDING", "OPEN", "IN_PROGRESS", "DONE", "CLOSED"], description: "Filter by lifecycle status" },
        type: { type: "string", enum: ["BUG", "FEATURE", "GENERAL"], description: "Filter by feedback type" },
        search: { type: "string", description: "Full-text match against title and content" },
        sort: { type: "string", enum: ["votes", "newest"], description: "Sort order (default votes)" },
        limit: { type: "number", description: "Max items to return, 1-100 (default 25)" },
      },
    },
  },
  {
    name: "get_feedback",
    description: "Fetch one feedback item with its full content, labels, board status, and comment thread.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Feedback id" } },
      required: ["id"],
    },
  },
  {
    name: "create_feedback",
    description:
      "Create a feedback item or internal task. internal=true (the default) marks it Dev-only: it shows on the team board but is hidden from the public widget, so agent work never leaks into the user-facing roadmap.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short title" },
        content: { type: "string", description: "Longer description (defaults to the title)" },
        type: { type: "string", enum: ["BUG", "FEATURE", "GENERAL"], description: "Item type (default GENERAL)" },
        status_name: { type: "string", description: "Name of the board column to place it in (default: first column)" },
        internal: { type: "boolean", description: "Hide from the public widget (default true)" },
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
      "Update a feedback item: move it to a board column by status_name (e.g. \"In progress\", \"Done\"), change its title, content, or type, or add/remove labels.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Feedback id" },
        status_name: { type: "string", description: "Target board column name" },
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
    description: "Post a comment on a feedback item as the team. Visible to the user who submitted it.",
    inputSchema: {
      type: "object",
      properties: {
        feedback_id: { type: "string", description: "Feedback id" },
        content: { type: "string", description: "Comment body" },
        author_name: { type: "string", description: "Display name (default \"Team\")" },
      },
      required: ["feedback_id", "content"],
    },
  },
  {
    name: "list_statuses",
    description: "List the project's board columns (statuses) with their colors and done-flags.",
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
  boardStatus: { select: { name: true, isDone: true } },
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
  boardStatus: { name: string; isDone: boolean } | null;
  labels: { name: string }[];
}) {
  return {
    id: f.id,
    title: f.title ?? f.content.slice(0, 80),
    content: f.content,
    type: f.type,
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
      const [byStatus, byType, statuses, top] = await Promise.all([
        db.feedback.groupBy({ by: ["status"], _count: { id: true }, where: { projectId: project.id } }),
        db.feedback.groupBy({ by: ["type"], _count: { id: true }, where: { projectId: project.id } }),
        db.status.findMany({ where: { projectId: project.id }, orderBy: { order: "asc" } }),
        db.feedback.findMany({
          where: { projectId: project.id, status: { in: ["OPEN", "IN_PROGRESS"] } },
          orderBy: { upvotes: "desc" },
          take: 5,
          select: feedbackSelect,
        }),
      ]);
      return toolText({
        project: project.name,
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
      const { status, type, search, sort, limit } = parsed.data;
      const items = await db.feedback.findMany({
        where: {
          projectId: project.id,
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
            select: { content: true, authorName: true, isOwner: true, createdAt: true },
          },
        },
      });
      if (!item) return toolError("Feedback not found in this project.");
      return toolText({
        ...serialize(item),
        comments: item.comments.map((c) => ({
          author: c.authorName ?? (c.isOwner ? "Team" : "User"),
          from_team: c.isOwner,
          content: c.content,
          created_at: c.createdAt.toISOString(),
        })),
      });
    }

    case "create_feedback": {
      const parsed = createFeedbackArgs.safeParse(args);
      if (!parsed.success) return toolError(`Invalid arguments: ${parsed.error.message}`);
      const { title, content, type, status_name, internal, labels } = parsed.data;

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

      const created = await db.feedback.create({
        data: {
          projectId: project.id,
          title,
          content: content || title,
          type,
          internal,
          status: boardStatus?.isDone ? "DONE" : "OPEN",
          statusId: boardStatus?.id ?? null,
          ...(labelIds.length ? { labels: { connect: labelIds.map((id) => ({ id })) } } : {}),
        },
        select: feedbackSelect,
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
      const { id, status_name, type, title, content, add_labels, remove_labels } = parsed.data;

      const existing = await db.feedback.findFirst({ where: { id, projectId: project.id } });
      if (!existing) return toolError("Feedback not found in this project.");

      let statusPatch: { statusId: string; status: "DONE" | "OPEN" } | null = null;
      if (status_name) {
        const target = await resolveStatus(project.id, status_name);
        if (!target) {
          return toolError(
            `No board column named "${status_name}". Use list_statuses to see available columns.`
          );
        }
        statusPatch = { statusId: target.id, status: target.isDone ? "DONE" : "OPEN" };
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

      const updated = await db.feedback.update({
        where: { id },
        data: {
          ...(statusPatch ?? {}),
          ...(type ? { type } : {}),
          ...(title ? { title } : {}),
          ...(content ? { content } : {}),
          ...(Object.keys(labelsPatch).length ? { labels: labelsPatch } : {}),
        },
        select: feedbackSelect,
      });

      if (statusPatch && statusPatch.status !== existing.status) {
        await queueIntegration({
          event: "STATUS_CHANGED",
          project: { id: project.id, name: project.name },
          feedback: { id, title: existing.title, content: existing.content, type: existing.type },
          oldStatus: existing.status,
          newStatus: statusPatch.status,
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
          authorName: author_name ?? "Team",
          isOwner: true,
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
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unauthorized: pass your project API key as a Bearer token" } },
      { status: 401, headers: { "WWW-Authenticate": "Bearer" } }
    );
  }

  const limited = await enforceProjectAndClientLimits(req, project.id, "mcp", {
    project: 2_000,
    client: 120,
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
          version: "1.0.0",
        },
        instructions:
          `Feedback inbox and task board for the project "${project.name}". ` +
          "Use get_project_overview first to see what's inside, list_feedback to browse by votes, " +
          "and update_feedback with a status_name to move items across the board. " +
          "Keep agent work internal: create_feedback defaults to internal=true (Dev-only, hidden from the public widget), " +
          "and create_board gives you a separate workspace without touching the main board. " +
          "Attach labels with create_feedback/update_feedback (they're created automatically from a name), " +
          "and give create_board a filters object (labels, type, or a creation-date range) for a board that only shows a slice of the inbox. " +
          "The main board never takes filters, it always shows everything.",
      });

    case "ping":
      return rpcResult(msg.id, {});

    case "tools/list":
      return rpcResult(msg.id, { tools: TOOLS });

    case "tools/call": {
      const name = (msg.params?.name as string) ?? "";
      const args = (msg.params?.arguments as Record<string, unknown>) ?? {};
      try {
        const result = await callTool(project, name, args);
        return rpcResult(msg.id, result);
      } catch (err) {
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
