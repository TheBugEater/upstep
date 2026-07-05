import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProjectAccess } from "@/lib/project-auth";

type RouteContext = { params: Promise<{ id: string; bid: string }> };

const filtersSchema = z
  .object({
    labelIds: z.array(z.string()).optional(),
    types: z.array(z.enum(["BUG", "FEATURE", "GENERAL"])).optional(),
    createdAfter: z.string().optional(),
    createdBefore: z.string().optional(),
  })
  .nullable()
  .optional();

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  columnStatusIds: z.array(z.string()).min(1).optional(),
  filters: filtersSchema,
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

  // The main board always shows everything — it doesn't take filters.
  if (board.isDefault && parsed.data.filters) {
    return NextResponse.json({ error: "The main board can't be filtered" }, { status: 400 });
  }

  if (parsed.data.filters?.labelIds?.length) {
    const labels = await db.label.findMany({
      where: { projectId: id, id: { in: parsed.data.filters.labelIds } },
      select: { id: true },
    });
    if (labels.length !== parsed.data.filters.labelIds.length) {
      return NextResponse.json({ error: "Invalid label IDs" }, { status: 400 });
    }
  }

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
      ...(parsed.data.filters !== undefined ? { filters: parsed.data.filters ?? Prisma.JsonNull } : {}),
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

  // The main board is permanent — it's the one guaranteed to show everything.
  if (board.isDefault) {
    return NextResponse.json({ error: "Cannot delete the main board" }, { status: 400 });
  }

  await db.board.delete({ where: { id: bid } });
  return NextResponse.json({ ok: true });
}
