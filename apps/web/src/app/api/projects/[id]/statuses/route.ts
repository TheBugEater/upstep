import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProjectAccess } from "@/lib/project-auth";

type RouteContext = { params: Promise<{ id: string }> };

// ─── GET /api/projects/[id]/statuses ─────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await getProjectAccess(id, session.user.id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const statuses = await db.status.findMany({
    where: { projectId: id },
    orderBy: { order: "asc" },
  });

  return NextResponse.json({ statuses });
}

// ─── POST /api/projects/[id]/statuses ────────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  isDone: z.boolean().optional(),
  // Append the new status as a column on every existing board so it is
  // usable immediately without editing each board.
  addToBoards: z.boolean().optional(),
});

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await getProjectAccess(id, session.user.id);
  if (!access || !access.isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const maxOrder = await db.status.aggregate({
    where: { projectId: id },
    _max: { order: true },
  });

  const status = await db.status.create({
    data: {
      projectId: id,
      name: parsed.data.name,
      color: parsed.data.color ?? "#94a3b8",
      order: (maxOrder._max.order ?? -1) + 1,
      isDone: parsed.data.isDone ?? false,
    },
  });

  if (parsed.data.addToBoards) {
    const boards = await db.board.findMany({
      where: { projectId: id },
      select: { id: true, columns: { select: { order: true } } },
    });
    if (boards.length > 0) {
      await db.boardColumn.createMany({
        data: boards.map((b) => ({
          boardId: b.id,
          statusId: status.id,
          order: Math.max(-1, ...b.columns.map((c) => c.order)) + 1,
        })),
      });
    }
  }

  return NextResponse.json(status, { status: 201 });
}
