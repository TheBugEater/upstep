import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/project-auth";

type RouteContext = { params: Promise<{ id: string; integrationId: string }> };

const INTEGRATION_EVENTS = ["NEW_FEEDBACK", "STATUS_CHANGED", "NEW_VOTE", "NEW_COMMENT"] as const;

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  name: z.string().max(100).optional(),
  events: z.array(z.enum(INTEGRATION_EVENTS)).min(1).optional(),
});

// ─── PATCH /api/projects/[id]/integrations/[integrationId] ───────────────────

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, integrationId } = await params;
  const isOwner = await requireOwner(id, session.user.id);
  if (!isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await db.integration.findFirst({ where: { id: integrationId, projectId: id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await db.integration.update({
    where: { id: integrationId },
    data: {
      ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
      ...(parsed.data.events !== undefined ? { events: parsed.data.events } : {}),
      ...(parsed.data.name !== undefined ? { name: parsed.data.name ?? null } : {}),
    },
    select: { id: true, type: true, name: true, webhookUrl: true, events: true, enabled: true, createdAt: true },
  });

  return NextResponse.json(updated);
}

// ─── DELETE /api/projects/[id]/integrations/[integrationId] ──────────────────

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, integrationId } = await params;
  const isOwner = await requireOwner(id, session.user.id);
  if (!isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await db.integration.findFirst({ where: { id: integrationId, projectId: id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.integration.delete({ where: { id: integrationId } });
  return NextResponse.json({ ok: true });
}
