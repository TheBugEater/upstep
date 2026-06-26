import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProjectAccess } from "@/lib/project-auth";
import { triggerIntegrations } from "@/lib/integrations";

const updateSchema = z.object({
  status: z.enum(["PENDING", "OPEN", "IN_PROGRESS", "DONE", "CLOSED"]).optional(),
  statusId: z.string().optional(),
  type: z.enum(["BUG", "FEATURE", "GENERAL"]).optional(),
  internal: z.boolean().optional(),
  addLabelId: z.string().optional(),
  removeLabelId: z.string().optional(),
});

type RouteContext = { params: Promise<{ id: string; fid: string }> };

// ─── PATCH /api/projects/[id]/feedback/[fid] ─────────────────────────────────

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, fid } = await params;
  const access = await getProjectAccess(id, session.user.id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const feedback = await db.feedback.findFirst({ where: { id: fid, projectId: id } });
  if (!feedback) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // When moving via statusId, resolve the Status record to sync the enum field
  let resolvedStatusEnum = parsed.data.status;
  let resolvedStatusId = parsed.data.statusId;

  if (parsed.data.statusId !== undefined) {
    if (parsed.data.statusId === null) {
      resolvedStatusId = null as unknown as string;
    } else {
      const customStatus = await db.status.findFirst({
        where: { id: parsed.data.statusId, projectId: id },
      });
      if (!customStatus) return NextResponse.json({ error: "Invalid statusId" }, { status: 400 });
      resolvedStatusEnum = customStatus.isDone ? "DONE" : "OPEN";
    }
  }

  const updated = await db.feedback.update({
    where: { id: fid },
    data: {
      ...(parsed.data.type ? { type: parsed.data.type } : {}),
      ...(resolvedStatusEnum ? { status: resolvedStatusEnum } : {}),
      ...(resolvedStatusId !== undefined ? { statusId: resolvedStatusId } : {}),
      ...(parsed.data.internal !== undefined ? { internal: parsed.data.internal } : {}),
      ...(parsed.data.addLabelId ? { labels: { connect: { id: parsed.data.addLabelId } } } : {}),
      ...(parsed.data.removeLabelId ? { labels: { disconnect: { id: parsed.data.removeLabelId } } } : {}),
    },
    include: { project: { select: { name: true } }, labels: { select: { id: true, name: true, color: true } } },
  });

  const effectiveNewStatus = resolvedStatusEnum ?? parsed.data.status;
  if (effectiveNewStatus && effectiveNewStatus !== feedback.status) {
    void triggerIntegrations({
      event: "STATUS_CHANGED",
      project: { id, name: updated.project.name },
      feedback: { id: fid, title: feedback.title, content: feedback.content, type: feedback.type },
      oldStatus: feedback.status,
      newStatus: effectiveNewStatus,
    }).catch(() => {});
  }

  return NextResponse.json(updated);
}

// ─── DELETE /api/projects/[id]/feedback/[fid] ────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, fid } = await params;
  const access = await getProjectAccess(id, session.user.id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const feedback = await db.feedback.findFirst({ where: { id: fid, projectId: id } });
  if (!feedback) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.feedback.delete({ where: { id: fid } });
  return NextResponse.json({ ok: true });
}
