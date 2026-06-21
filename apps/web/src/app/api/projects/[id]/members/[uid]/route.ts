import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/project-auth";

type RouteContext = { params: Promise<{ id: string; uid: string }> };

// ─── DELETE /api/projects/[id]/members/[uid] ─────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, uid } = await params;
  const isOwner = await requireOwner(id, session.user.id);
  if (!isOwner) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.projectMember.deleteMany({
    where: { projectId: id, userId: uid },
  });

  return NextResponse.json({ ok: true });
}
