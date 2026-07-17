import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProjectAccess } from "@/lib/project-auth";

type RouteContext = { params: Promise<{ id: string; lid: string }> };

const updateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

// ─── PATCH /api/projects/[id]/labels/[lid] ────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, lid } = await params;
  const access = await getProjectAccess(id, session.user.id);
  if (!access || !access.isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const label = await db.label.findFirst({ where: { id: lid, projectId: id } });
  if (!label) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  if (parsed.data.name) {
    const clash = await db.label.findFirst({
      where: { projectId: id, name: { equals: parsed.data.name, mode: "insensitive" }, id: { not: lid } },
    });
    if (clash) return NextResponse.json({ error: "A label with that name already exists" }, { status: 400 });
  }

  const updated = await db.label.update({
    where: { id: lid },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.color !== undefined ? { color: parsed.data.color } : {}),
    },
    select: { id: true, name: true, color: true },
  });

  return NextResponse.json(updated);
}

// ─── DELETE /api/projects/[id]/labels/[lid] ───────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, lid } = await params;
  const access = await getProjectAccess(id, session.user.id);
  if (!access || !access.isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const label = await db.label.findFirst({ where: { id: lid, projectId: id } });
  if (!label) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Detaches from every feedback item automatically (implicit m2m relation).
  // Any board.filters.labelIds referencing this id just stop matching
  // anything, the filter and MCP list_boards output both already drop
  // unknown label ids gracefully rather than erroring.
  await db.label.delete({ where: { id: lid } });
  return NextResponse.json({ ok: true });
}
