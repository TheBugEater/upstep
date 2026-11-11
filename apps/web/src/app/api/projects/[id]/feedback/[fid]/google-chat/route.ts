import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProjectAccess } from "@/lib/project-auth";
import { discussionJobId, startGoogleChatDiscussion } from "@/lib/google-chat-discussions";
import { CollaborationError } from "@/lib/project-collaboration";
import { kickNotificationProcessor } from "@/lib/notification-queue";
import { googleChatThreadUrl } from "@/lib/google-chat";

type Context = { params: Promise<{ id: string; fid: string }> };

export async function GET(_req: NextRequest, { params }: Context) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, fid } = await params;
  if (!await getProjectAccess(id, session.user.id) || !await db.feedback.findFirst({ where: { id: fid, projectId: id }, select: { id: true } })) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const spaces = await db.integration.findMany({ where: { projectId: id, type: "GOOGLE_CHAT", enabled: true, project: { owner: { plan: { in: ["PRO", "BUSINESS"] } } } }, select: { id: true, name: true, webhookUrl: true, chatThreads: { where: { feedbackId: fid }, select: { threadName: true } } } });
  const jobs = await db.notificationJob.findMany({ where: { id: { in: spaces.map((s) => discussionJobId(s.id, fid)) } }, select: { id: true, status: true, lastError: true, availableAt: true } });
  // Members see space names, delivery state and the thread link, never webhook credentials.
  return NextResponse.json({ spaces: spaces.map((s) => {
    const job = jobs.find((j) => j.id === discussionJobId(s.id, fid));
    const thread = s.chatThreads[0];
    return {
      id: s.id, name: s.name,
      status: job?.status ?? null, lastError: job?.lastError ?? null, availableAt: job?.availableAt ?? null,
      threadUrl: thread ? googleChatThreadUrl(s.webhookUrl, thread.threadName) : null,
    };
  }) });
}

export async function POST(req: NextRequest, { params }: Context) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, fid } = await params;
  const parsed = z.object({ integrationId: z.string().min(1) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a connected Google Chat space." }, { status: 400 });
  try {
    const result = await startGoogleChatDiscussion({ projectId: id, feedbackId: fid, integrationId: parsed.data.integrationId, actorId: session.user.id });
    if (result.status !== "COMPLETED") kickNotificationProcessor();
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CollaborationError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
