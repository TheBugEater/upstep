import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const updateSchema = z.object({
  moderationEnabled: z.boolean().optional(),
  name: z.string().min(1).max(100).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// ─── PATCH /api/projects/[id] ─────────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const project = await db.project.findFirst({
    where: { id, ownerId: session.user.id },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await db.project.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.moderationEnabled !== undefined ? { moderationEnabled: parsed.data.moderationEnabled } : {}),
    },
  });

  return NextResponse.json(updated);
}

// ─── DELETE /api/projects/[id] ────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const project = await db.project.findFirst({
    where: { id, ownerId: session.user.id },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
