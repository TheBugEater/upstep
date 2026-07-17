import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProjectAccess } from "@/lib/project-auth";

type RouteContext = { params: Promise<{ id: string }> };

// ─── GET /api/projects/[id]/boards ────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await getProjectAccess(id, session.user.id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const boards = await db.board.findMany({
    where: { projectId: id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    include: {
      columns: {
        orderBy: { order: "asc" },
        include: { status: true },
      },
    },
  });

  return NextResponse.json({ boards });
}

// ─── POST /api/projects/[id]/boards ───────────────────────────────────────────

const filtersSchema = z
  .object({
    labelIds: z.array(z.string()).optional(),
    types: z.array(z.enum(["BUG", "FEATURE", "GENERAL"])).optional(),
    createdAfter: z.string().optional(),
    createdBefore: z.string().optional(),
  })
  .nullable()
  .optional();

const createSchema = z.object({
  name: z.string().min(1).max(100),
  columnStatusIds: z.array(z.string()).min(1),
  filters: filtersSchema,
  isPublic: z.boolean().optional(),
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

  // Validate all statusIds belong to this project
  const statuses = await db.status.findMany({
    where: { projectId: id, id: { in: parsed.data.columnStatusIds } },
    select: { id: true },
  });
  if (statuses.length !== parsed.data.columnStatusIds.length) {
    return NextResponse.json({ error: "Invalid status IDs" }, { status: 400 });
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

  // New boards are never the default/main board, so this is a regular
  // filterable board. That identity is fixed at project creation and isn't
  // exposed anywhere for change.
  if (parsed.data.isPublic) {
    await db.board.updateMany({ where: { projectId: id }, data: { isPublic: false } });
  }

  const board = await db.board.create({
    data: {
      projectId: id,
      name: parsed.data.name,
      isDefault: false,
      isPublic: parsed.data.isPublic ?? false,
      ...(parsed.data.filters ? { filters: parsed.data.filters } : {}),
      columns: {
        create: parsed.data.columnStatusIds.map((statusId, order) => ({ statusId, order })),
      },
    },
    include: {
      columns: {
        orderBy: { order: "asc" },
        include: { status: true },
      },
    },
  });

  return NextResponse.json(board, { status: 201 });
}
