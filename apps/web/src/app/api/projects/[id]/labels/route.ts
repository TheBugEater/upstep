import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProjectAccess } from "@/lib/project-auth";

type RouteContext = { params: Promise<{ id: string }> };

// ─── GET /api/projects/[id]/labels ───────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await getProjectAccess(id, session.user.id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const labels = await db.label.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, color: true },
  });

  return NextResponse.json({ labels });
}

// ─── POST /api/projects/[id]/labels ──────────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6366f1"),
});

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await getProjectAccess(id, session.user.id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const label = await db.label.upsert({
    where: { projectId_name: { projectId: id, name: parsed.data.name } },
    create: { projectId: id, name: parsed.data.name, color: parsed.data.color },
    update: {},
    select: { id: true, name: true, color: true },
  });

  return NextResponse.json(label, { status: 201 });
}
