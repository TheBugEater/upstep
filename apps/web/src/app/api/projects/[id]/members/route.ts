import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/project-auth";
import { createProjectInvitation } from "@/lib/project-invitations";
import { kickNotificationProcessor } from "@/lib/notification-queue";

type RouteContext = { params: Promise<{ id: string }> };

// ─── GET /api/projects/[id]/members ──────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const isOwner = await requireOwner(id, session.user.id);
  if (!isOwner) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const members = await db.projectMember.findMany({
    where: { projectId: id },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(members);
}

// ─── POST /api/projects/[id]/members ─────────────────────────────────────────

const addSchema = z.object({ email: z.string().trim().toLowerCase().email() });

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const project = await db.project.findFirst({
    where: { id, ownerId: session.user.id },
    select: { name: true, owner: { select: { name: true, email: true } } },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const { email } = parsed.data;

  // Can't invite yourself (already the owner).
  if (email === project.owner.email.trim().toLowerCase()) {
    return NextResponse.json(
      { error: "You're already the owner of this project." },
      { status: 400 }
    );
  }

  const result = await db.$transaction((tx) => createProjectInvitation({
    projectId: id,
    projectName: project.name,
    inviterName: project.owner.name,
    email,
  }, tx));
  if (result.emailQueued) kickNotificationProcessor();

  return NextResponse.json(result, { status: result.emailQueued ? 201 : 200 });
}
