import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { changeMemberRole, removeProjectMember, CollaborationError } from "@/lib/project-collaboration";

type RouteContext = { params: Promise<{ id: string; uid: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, uid } = await params;
  const parsed = z.object({ role: z.enum(["ADMIN", "MEMBER"]) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose Admin or Member." }, { status: 400 });
  try {
    return NextResponse.json(await changeMemberRole({ projectId: id, actorId: session.user.id, userId: uid, role: parsed.data.role }));
  } catch (error) {
    if (error instanceof CollaborationError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, uid } = await params;
  try {
    return NextResponse.json(await removeProjectMember({ projectId: id, actorId: session.user.id, userId: uid }));
  } catch (error) {
    if (error instanceof CollaborationError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
