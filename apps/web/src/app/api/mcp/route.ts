import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { triggerIntegrations } from "@/lib/integrations";

/**
 * Upstep MCP server — Streamable HTTP transport (JSON responses).
 *
 * Any MCP client (Claude Code, Claude Desktop, Cursor, …) can connect with:
 *   claude mcp add --transport http upstep https://upstep.dev/api/mcp \
 *     --header "Authorization: Bearer <project API key>"
 *
 * The API key scopes every tool to a single project, so an agent can browse,
 * triage, create, and comment on feedback — nothing else.
 */

const PROTOCOL_VERSION = "2025-06-18";

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
});

const updateFeedbackArgs = z.object({
  id: z.string(),
  status_name: z.string().optional(),
  type: z.enum(["BUG", "FEATURE", "GENERAL"]).optional(),
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(5000).optional(),
});

const addCommentArgs = z.object({
  feedback_id: z.string(),
  content: z.string().min(1).max(2000),
  author_name: z.string().max(80).optional(),
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
      "Create a feedback item or internal task on the board. Set internal=true (default) for team/dev tasks that users shouldn't see in the widget.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short title" },
        content: { type: "string", description: "Longer description (defaults to the title)" },
        type: { type: "string", enum: ["BUG", "FEATURE", "GENERAL"], description: "Item type (default GENERAL)" },
        status_name: { type: "string", description: "Name of the board column to place it in (default: first column)" },
        internal: { type: "boolean", description: "Hide from the public widget (default true)" },
      },
      required: ["title"],
    },
  },
  {
    name: "update_feedback",
    description:
      "Update a feedback item: move it to a board column by status_name (e.g. \"In progress\", \"Done\"), or change its title, content, or type.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Feedback id" },
        status_name: { type: "string", description: "Target board column name" },
        type: { type: "string", enum: ["BUG", "FEATURE", "GENERAL"] },
        title: { type: "string" },
        content: { type: "string" },
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
      const { title, content, type, status_name, internal } = parsed.data;

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

      const created = await db.feedback.create({
        data: {
          projectId: project.id,
          title,
          content: content || title,
          type,
          internal,
          status: boardStatus?.isDone ? "DONE" : "OPEN",
          statusId: boardStatus?.id ?? null,
        },
        select: feedbackSelect,
      });

      void triggerIntegrations({
        event: "NEW_FEEDBACK",
        project: { id: project.id, name: project.name },
        feedback: { id: created.id, title, content: content || title, type },
      }).catch(() => {});

      return toolText({ created: serialize(created) });
    }

    case "update_feedback": {
      const parsed = updateFeedbackArgs.safeParse(args);
      if (!parsed.success) return toolError(`Invalid arguments: ${parsed.error.message}`);
      const { id, status_name, type, title, content } = parsed.data;

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

      const updated = await db.feedback.update({
        where: { id },
        data: {
          ...(statusPatch ?? {}),
          ...(type ? { type } : {}),
          ...(title ? { title } : {}),
          ...(content ? { content } : {}),
        },
        select: feedbackSelect,
      });

      if (statusPatch && statusPatch.status !== existing.status) {
        void triggerIntegrations({
          event: "STATUS_CHANGED",
          project: { id: project.id, name: project.name },
          feedback: { id, title: existing.title, content: existing.content, type: existing.type },
          oldStatus: existing.status,
          newStatus: statusPatch.status,
        }).catch(() => {});
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

      void triggerIntegrations({
        event: "NEW_COMMENT",
        project: { id: project.id, name: project.name },
        feedback: { id: feedback.id, title: feedback.title, content: feedback.content, type: feedback.type },
        comment: { content, authorName: comment.authorName },
      }).catch(() => {});

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
          title: `Upstep — ${project.name}`,
          version: "1.0.0",
        },
        instructions:
          `Feedback inbox and task board for the project "${project.name}". ` +
          "Use get_project_overview first to see what's inside, list_feedback to browse by votes, " +
          "and update_feedback with a status_name to move items across the board.",
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

// Session teardown — we're stateless, so acknowledge and move on.
export function DELETE() {
  return new NextResponse(null, { status: 200 });
}
