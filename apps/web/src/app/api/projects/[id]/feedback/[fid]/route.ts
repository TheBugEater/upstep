import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const updateSchema = z.object({
  status: z.enum(["PENDING", "OPEN", "IN_PROGRESS", "DONE", "CLOSED"]).optional(),
  type: z.enum(["BUG", "FEATURE", "GENERAL"]).optional(),
});

type RouteContext = { params: Promise<{ id: string; fid: string }> };

async function getOwnedFeedback(session: { user?: { id?: string | null } | null }, projectId: string, fid: string) {
  const userId = session.user?.id;
  if (!userId) return null;
  const project = await db.project.findFirst({
    where: { id: projectId, ownerId: userId },
  });
  if (!project) return null;

  return db.feedback.findFirst({ where: { id: fid, projectId } });
}

// ─── PATCH /api/projects/[id]/feedback/[fid] ─────────────────────────────────

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, fid } = await params;
  const feedback = await getOwnedFeedback(session, id, fid);
  if (!feedback) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

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
  });

  return NextResponse.json(updated);
}

// ─── DELETE /api/projects/[id]/feedback/[fid] ────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, fid } = await params;
  const feedback = await getOwnedFeedback(session, id, fid);
  if (!feedback) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.feedback.delete({ where: { id: fid } });
  return NextResponse.json({ ok: true });
}
