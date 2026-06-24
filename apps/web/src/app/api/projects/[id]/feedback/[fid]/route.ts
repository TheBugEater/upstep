import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProjectAccess } from "@/lib/project-auth";
import { triggerIntegrations } from "@/lib/integrations";

const updateSchema = z.object({
  status: z.enum(["PENDING", "OPEN", "IN_PROGRESS", "DONE", "CLOSED"]).optional(),
  type: z.enum(["BUG", "FEATURE", "GENERAL"]).optional(),
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

  const updated = await db.feedback.update({
    where: { id: fid },
    data: {
      ...(parsed.data.type ? { type: parsed.data.type } : {}),
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
    },
    include: { project: { select: { name: true } } },
  });

  if (parsed.data.status && parsed.data.status !== feedback.status) {
    void triggerIntegrations({
      event: "STATUS_CHANGED",
      project: { id, name: updated.project.name },
      feedback: { id: fid, title: feedback.title, content: feedback.content, type: feedback.type },
      oldStatus: feedback.status,
      newStatus: parsed.data.status,
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
