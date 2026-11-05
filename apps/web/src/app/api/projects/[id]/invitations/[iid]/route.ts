import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/project-auth";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; iid: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, iid } = await params;
  if (!await requireAdmin(id, session.user.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.projectInvitation.updateMany({
    where: { id: iid, projectId: id, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
