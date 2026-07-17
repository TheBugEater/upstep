import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProjectAccess } from "@/lib/project-auth";

type RouteContext = { params: Promise<{ id: string; sid: string }> };

const updateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  isDone: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
});

// ─── PATCH /api/projects/[id]/statuses/[sid] ──────────────────────────────────

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, sid } = await params;
  const access = await getProjectAccess(id, session.user.id);
  if (!access || !access.isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const status = await db.status.findFirst({ where: { id: sid, projectId: id } });
  if (!status) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await db.status.update({
    where: { id: sid },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.color !== undefined ? { color: parsed.data.color } : {}),
      ...(parsed.data.isDone !== undefined ? { isDone: parsed.data.isDone } : {}),
      ...(parsed.data.order !== undefined ? { order: parsed.data.order } : {}),
    },
  });

  return NextResponse.json(updated);
}

// ─── DELETE /api/projects/[id]/statuses/[sid] ─────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, sid } = await params;
  const access = await getProjectAccess(id, session.user.id);
  if (!access || !access.isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const status = await db.status.findFirst({ where: { id: sid, projectId: id } });
  if (!status) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Prevent deleting the last status
  const count = await db.status.count({ where: { projectId: id } });
  if (count <= 1) return NextResponse.json({ error: "Cannot delete the last status" }, { status: 400 });

  await db.status.delete({ where: { id: sid } });
  return NextResponse.json({ ok: true });
}
