import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/project-auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!await requireAdmin(id, session.user.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(await db.projectInvitation.findMany({
    where: { projectId: id, acceptedAt: null, revokedAt: null },
    select: { id: true, email: true, expiresAt: true, createdAt: true, lastSentAt: true },
    orderBy: { createdAt: "desc" },
  }));
}
