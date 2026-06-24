import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProjectAccess } from "@/lib/project-auth";
import { triggerIntegrations } from "@/lib/integrations";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const access = await getProjectAccess(id, session.user.id);
  if (!access) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const sort = searchParams.get("sort") === "votes" ? "upvotes" : "createdAt";

  const feedback = await db.feedback.findMany({
    where: {
      projectId: id,
      ...(type ? { type: type as never } : {}),
      ...(status ? { status: status as never } : {}),
    },
    orderBy: { [sort]: "desc" },
    take: 50,
  });

  return NextResponse.json(feedback);
}

// ─── POST /api/projects/[id]/feedback ────────────────────────────────────────
// Lets dashboard users (owners + members) add tasks/feedback directly.

const createSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(2000),
  type: z.enum(["BUG", "FEATURE", "GENERAL"]).default("GENERAL"),
  status: z.enum(["OPEN", "IN_PROGRESS"]).default("OPEN"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const access = await getProjectAccess(id, session.user.id);
  if (!access) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const project = await db.project.findUnique({
    where: { id },
    select: { name: true },
  });

  const feedback = await db.feedback.create({
    data: {
      projectId: id,
      ...(parsed.data.title ? { title: parsed.data.title } : {}),
      content: parsed.data.content,
      type: parsed.data.type,
      status: parsed.data.status,
      flagged: false,
      upvotes: 0,
    },
  });

  void triggerIntegrations({
    event: "NEW_FEEDBACK",
    project: { id, name: project?.name ?? "" },
    feedback: { id: feedback.id, title: feedback.title, content: feedback.content, type: feedback.type, status: feedback.status, flagged: false },
  }).catch(() => {});

  return NextResponse.json(feedback, { status: 201 });
}
