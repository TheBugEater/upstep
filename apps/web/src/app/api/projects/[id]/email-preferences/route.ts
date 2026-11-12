import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProjectAccess } from "@/lib/project-auth";
import { resolveEmailPrefs } from "@/lib/email-notifications";

type Context = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  newFeedback: z.boolean().optional(),
  assigned: z.boolean().optional(),
  comments: z.boolean().optional(),
  statusChanges: z.boolean().optional(),
}).strict();

async function load(projectId: string, userId: string) {
  const [project, stored] = await Promise.all([
    db.project.findUnique({ where: { id: projectId }, select: { ownerId: true } }),
    db.emailPreference.findUnique({ where: { userId_projectId: { userId, projectId } } }),
  ]);
  return resolveEmailPrefs(stored, project?.ownerId === userId);
}

/** The signed-in person's own email settings for this project. */
export async function GET(_req: NextRequest, { params }: Context) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!await getProjectAccess(id, session.user.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    prefs: await load(id, session.user.id),
    email: session.user.email,
    // Without a provider the settings are kept but nothing is sent.
    emailEnabled: Boolean(process.env.SENDPANDA_API_KEY),
  });
}

export async function PATCH(req: NextRequest, { params }: Context) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!await getProjectAccess(id, session.user.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid settings." }, { status: 400 });
  // Store the full resolved set so later default changes don't flip a choice
  // this person already made.
  const current = await load(id, session.user.id);
  const next = {
    newFeedback: parsed.data.newFeedback ?? current.newFeedback,
    assigned: parsed.data.assigned ?? current.assigned,
    comments: parsed.data.comments ?? current.comments,
    statusChanges: parsed.data.statusChanges ?? current.statusChanges,
  };
  await db.emailPreference.upsert({
    where: { userId_projectId: { userId: session.user.id, projectId: id } },
    create: { userId: session.user.id, projectId: id, ...next },
    update: next,
  });
  return NextResponse.json({ prefs: next });
}
