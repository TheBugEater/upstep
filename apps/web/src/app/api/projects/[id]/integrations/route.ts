import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/project-auth";

type RouteContext = { params: Promise<{ id: string }> };

const INTEGRATION_EVENTS = ["NEW_FEEDBACK", "STATUS_CHANGED", "NEW_VOTE", "NEW_COMMENT"] as const;
const INTEGRATION_TYPES = ["SLACK", "DISCORD", "WEBHOOK"] as const;

const createSchema = z.object({
  type: z.enum(INTEGRATION_TYPES),
  name: z.string().max(100).optional(),
  webhookUrl: z.string().url().max(500),
  events: z.array(z.enum(INTEGRATION_EVENTS)).min(1),
});

// ─── GET /api/projects/[id]/integrations ─────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const isOwner = await requireOwner(id, session.user.id);
  if (!isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const integrations = await db.integration.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "asc" },
    select: { id: true, type: true, name: true, webhookUrl: true, events: true, enabled: true, createdAt: true },
  });

  return NextResponse.json({ integrations });
}

// ─── POST /api/projects/[id]/integrations ────────────────────────────────────

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const isOwner = await requireOwner(id, session.user.id);
  if (!isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Plan gate - integrations require PRO or BUSINESS
  const project = await db.project.findUnique({
    where: { id },
    select: { owner: { select: { plan: true } } },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!["PRO", "BUSINESS"].includes(project.owner.plan)) {
    return NextResponse.json({ error: "Integrations require a Pro or Business plan." }, { status: 402 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const integration = await db.integration.create({
    data: {
      projectId: id,
      type: parsed.data.type,
      name: parsed.data.name ?? null,
      webhookUrl: parsed.data.webhookUrl,
      events: parsed.data.events,
    },
    select: { id: true, type: true, name: true, webhookUrl: true, events: true, enabled: true, createdAt: true },
  });

  return NextResponse.json(integration, { status: 201 });
}
