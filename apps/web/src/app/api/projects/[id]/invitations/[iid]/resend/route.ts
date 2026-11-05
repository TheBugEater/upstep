import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createProjectInvitation, InvitationError } from "@/lib/project-invitations";
import { kickNotificationProcessor } from "@/lib/notification-queue";
import { requireAdmin } from "@/lib/project-auth";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string; iid: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, iid } = await params;
  if (!await requireAdmin(id, session.user.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const project = await db.project.findFirst({
    where: { id }, select: { name: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const invitation = await db.projectInvitation.findFirst({ where: { id: iid, projectId: id, acceptedAt: null, revokedAt: null } });
  if (!invitation) return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  try {
    const result = await db.$transaction((tx) => createProjectInvitation({
      projectId: id, projectName: project.name, inviterName: session.user?.name ?? null,
      email: invitation.email, resend: true,
    }, tx));
    if (result.emailQueued) kickNotificationProcessor();
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof InvitationError && error.code === "resend-too-soon") {
      return NextResponse.json({ error: "Please wait a minute before resending this invitation." }, { status: 429 });
    }
    throw error;
  }
}
