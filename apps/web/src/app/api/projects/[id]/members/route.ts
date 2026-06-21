import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/project-auth";

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

const addSchema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const isOwner = await requireOwner(id, session.user.id);
  if (!isOwner) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const { email } = parsed.data;

  // Can't invite yourself (already the owner).
  if (email.toLowerCase() === session.user.email?.toLowerCase()) {
    return NextResponse.json(
      { error: "You're already the owner of this project." },
      { status: 400 }
    );
  }

  const invitee = await db.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, name: true, email: true, image: true },
  });
  if (!invitee) {
    return NextResponse.json(
      { error: "No Upstep account found for that email. They need to sign up first." },
      { status: 404 }
    );
  }

  // Upsert so re-inviting is idempotent.
  const member = await db.projectMember.upsert({
    where: { projectId_userId: { projectId: id, userId: invitee.id } },
    create: { projectId: id, userId: invitee.id, role: "MEMBER" },
    update: {},
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
  });

  return NextResponse.json(member, { status: 201 });
}
