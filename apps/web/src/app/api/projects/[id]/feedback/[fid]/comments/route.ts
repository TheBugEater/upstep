import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProjectAccess } from "@/lib/project-auth";
import { kickNotificationProcessor } from "@/lib/notification-queue";

import { addTaskComment } from "@/lib/task-comments";
import { CollaborationError } from "@/lib/project-collaboration";

const commentSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  parentId: z.string().optional(),
});

type RouteContext = { params: Promise<{ id: string; fid: string }> };

// ─── GET /api/projects/[id]/feedback/[fid]/comments ──────────────────────────

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, fid } = await params;
  const access = await getProjectAccess(id, session.user.id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const comments = await db.comment.findMany({
    where: { feedbackId: fid, feedback: { projectId: id } },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, name: true, image: true } } },
  });

  return NextResponse.json(comments);
}

// ─── POST /api/projects/[id]/feedback/[fid]/comments ─────────────────────────

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, fid } = await params;
  const parsed = commentSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    const comment = await addTaskComment({ projectId: id, feedbackId: fid, actorId: session.user.id, content: parsed.data.content, ...(parsed.data.parentId ? { parentId: parsed.data.parentId } : {}) });
    kickNotificationProcessor();
    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    if (error instanceof CollaborationError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
