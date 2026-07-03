import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProjectAccess } from "@/lib/project-auth";
import { triggerIntegrations } from "@/lib/integrations";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const access = await getProjectAccess(id, session.user.id);
  if (!access) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const sort = searchParams.get("sort") === "votes" ? "upvotes" : "createdAt";
  const take = Math.min(Number(searchParams.get("take")) || 50, 300);

  const feedback = await db.feedback.findMany({
    where: {
      projectId: id,
      ...(type ? { type: type as never } : {}),
      ...(status
        ? { status: { in: status.split(",") as never } }
        : {}),
    },
    orderBy: { [sort]: "desc" },
    take,
    include: {
      labels: { select: { id: true, name: true, color: true } },
      boardStatus: { select: { id: true, name: true, color: true, order: true, isDone: true } },
    },
  });

  return NextResponse.json(feedback);
}

// ─── POST /api/projects/[id]/feedback ────────────────────────────────────────
// Lets dashboard users (owners + members) add tasks/feedback directly.

const createSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(2000),
  type: z.enum(["BUG", "FEATURE", "GENERAL"]).default("GENERAL"),
  status: z.enum(["OPEN", "IN_PROGRESS"]).default("OPEN"),
  internal: z.boolean().default(false),
  statusId: z.string().optional(),
  labelIds: z.array(z.string()).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const access = await getProjectAccess(id, session.user.id);
  if (!access) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const project = await db.project.findUnique({
    where: { id },
    select: { name: true },
  });

  // Place the card in the requested column, or fall back to the first
  // non-done status so it always appears on the board.
  let boardStatus: { id: string; isDone: boolean } | null = null;
  if (parsed.data.statusId) {
    boardStatus = await db.status.findFirst({
      where: { id: parsed.data.statusId, projectId: id },
      select: { id: true, isDone: true },
    });
    if (!boardStatus) {
      return NextResponse.json({ error: "Invalid statusId" }, { status: 400 });
    }
  } else {
    boardStatus = await db.status.findFirst({
      where: { projectId: id, isDone: false },
      orderBy: { order: "asc" },
      select: { id: true, isDone: true },
    });
  }

  if (parsed.data.labelIds?.length) {
    const labels = await db.label.findMany({
      where: { projectId: id, id: { in: parsed.data.labelIds } },
      select: { id: true },
    });
    if (labels.length !== parsed.data.labelIds.length) {
      return NextResponse.json({ error: "Invalid label IDs" }, { status: 400 });
    }
  }

  const feedback = await db.feedback.create({
    data: {
      projectId: id,
      ...(parsed.data.title ? { title: parsed.data.title } : {}),
      content: parsed.data.content,
      type: parsed.data.type,
      status: boardStatus?.isDone ? "DONE" : parsed.data.status,
      ...(boardStatus ? { statusId: boardStatus.id } : {}),
      internal: parsed.data.internal,
      flagged: false,
      upvotes: 0,
      ...(parsed.data.labelIds?.length
        ? { labels: { connect: parsed.data.labelIds.map((lid) => ({ id: lid })) } }
        : {}),
    },
    include: {
      labels: { select: { id: true, name: true, color: true } },
      boardStatus: { select: { id: true, name: true, color: true, order: true, isDone: true } },
    },
  });

  void triggerIntegrations({
    event: "NEW_FEEDBACK",
    project: { id, name: project?.name ?? "" },
    feedback: { id: feedback.id, title: feedback.title, content: feedback.content, type: feedback.type, status: feedback.status, flagged: false },
  }).catch(() => {});

  return NextResponse.json(feedback, { status: 201 });
}
