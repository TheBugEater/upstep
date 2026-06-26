import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProjectAccess } from "@/lib/project-auth";

type RouteContext = { params: Promise<{ id: string; bid: string }> };

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isDefault: z.boolean().optional(),
  columnStatusIds: z.array(z.string()).min(1).optional(),
});

// ─── PATCH /api/projects/[id]/boards/[bid] ────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, bid } = await params;
  const access = await getProjectAccess(id, session.user.id);
  if (!access || !access.isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const board = await db.board.findFirst({ where: { id: bid, projectId: id } });
  if (!board) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // If updating columns, validate statusIds and replace all columns atomically
  if (parsed.data.columnStatusIds) {
    const statuses = await db.status.findMany({
      where: { projectId: id, id: { in: parsed.data.columnStatusIds } },
      select: { id: true },
    });
    if (statuses.length !== parsed.data.columnStatusIds.length) {
      return NextResponse.json({ error: "Invalid status IDs" }, { status: 400 });
    }

    await db.$transaction([
      db.boardColumn.deleteMany({ where: { boardId: bid } }),
      ...parsed.data.columnStatusIds.map((statusId, order) =>
        db.boardColumn.create({ data: { boardId: bid, statusId, order } })
      ),
    ]);
  }

  const updated = await db.board.update({
    where: { id: bid },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.isDefault !== undefined ? { isDefault: parsed.data.isDefault } : {}),
    },
    include: {
      columns: {
        orderBy: { order: "asc" },
        include: { status: true },
      },
    },
  });

  return NextResponse.json(updated);
}

// ─── DELETE /api/projects/[id]/boards/[bid] ───────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, bid } = await params;
  const access = await getProjectAccess(id, session.user.id);
  if (!access || !access.isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const board = await db.board.findFirst({ where: { id: bid, projectId: id } });
  if (!board) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Prevent deleting the last board
  const count = await db.board.count({ where: { projectId: id } });
  if (count <= 1) return NextResponse.json({ error: "Cannot delete the last board" }, { status: 400 });

  await db.board.delete({ where: { id: bid } });
  return NextResponse.json({ ok: true });
}
