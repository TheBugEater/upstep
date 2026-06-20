import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { nanoid } from "nanoid";
import { getPlan, formatLimit } from "@/lib/plans";

// ─── GET /api/projects ────────────────────────────────────────────────────────

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projects = await db.project.findMany({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { feedback: true } } },
  });

  return NextResponse.json(projects);
}

// ─── POST /api/projects ───────────────────────────────────────────────────────

const createSchema = z.object({ name: z.string().min(1).max(80) });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Enforce the project cap for the account's plan.
  const [user, projectCount] = await Promise.all([
    db.user.findUnique({ where: { id: session.user.id }, select: { plan: true } }),
    db.project.count({ where: { ownerId: session.user.id } }),
  ]);
  const plan = getPlan(user?.plan);
  if (projectCount >= plan.projectLimit) {
    return NextResponse.json(
      {
        error: `Your ${plan.name} plan allows ${formatLimit(plan.projectLimit)} project${plan.projectLimit === 1 ? "" : "s"}. Upgrade to add more.`,
        code: "PROJECT_LIMIT",
      },
      { status: 402 }
    );
  }

  const project = await db.project.create({
    data: {
      name: parsed.data.name,
      apiKey: `upstep_${nanoid(32)}`,
      ownerId: session.user.id,
    },
  });

  return NextResponse.json(project, { status: 201 });
}
