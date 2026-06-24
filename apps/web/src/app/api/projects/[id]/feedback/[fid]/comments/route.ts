import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProjectAccess } from "@/lib/project-auth";
import { triggerIntegrations } from "@/lib/integrations";

const commentSchema = z.object({
  content: z.string().min(1).max(2000),
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
  const access = await getProjectAccess(id, session.user.id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const feedback = await db.feedback.findFirst({
    where: { id: fid, projectId: id },
    include: { project: { select: { name: true } } },
  });
  if (!feedback) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const comment = await db.comment.create({
    data: {
      feedbackId: fid,
      content: parsed.data.content,
      authorName: session.user.name ?? session.user.email ?? "Team",
      isOwner: true,
    },
  });

  void triggerIntegrations({
    event: "NEW_COMMENT",
    project: { id, name: feedback.project.name },
    feedback: { id: fid, title: feedback.title, content: feedback.content, type: feedback.type },
    comment: { content: comment.content, authorName: comment.authorName },
  }).catch(() => {});

  return NextResponse.json(comment, { status: 201 });
}
