import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPlan, formatLimit } from "@/lib/plans";
import { beginBusinessLearning } from "@/lib/support/learning";
import { normalizeDomain } from "@/lib/support/crawler";
import { processSupportJobs } from "@/lib/support/worker";
import { SupportError } from "@/lib/support/policy";
import { createProjectWithDefaults } from "@/lib/projects";

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

const createSchema = z
  .object({
    name: z.string().trim().max(80).optional(),
    website: z.string().trim().max(253).optional(),
  })
  .refine((x) => !!x.name || !!x.website);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Enforce the project cap for the account's plan.
  const [user, projectCount] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true },
    }),
    db.project.count({ where: { ownerId: session.user.id } }),
  ]);
  const plan = getPlan(user?.plan);
  if (projectCount >= plan.projectLimit) {
    return NextResponse.json(
      {
        error: `Your ${plan.name} plan allows ${formatLimit(plan.projectLimit)} project${plan.projectLimit === 1 ? "" : "s"}. Upgrade to add more.`,
        code: "PROJECT_LIMIT",
      },
      { status: 402 },
    );
  }

  let domain: string | undefined;
  try {
    if (parsed.data.website) domain = normalizeDomain(parsed.data.website);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof SupportError
            ? error.message
            : "Enter a valid website.",
      },
      { status: 400 },
    );
  }
  const project = await createProjectWithDefaults(
    parsed.data.name || domain!,
    session.user.id,
  );
  const supportSetupQueued =
    !!domain && ["PRO", "BUSINESS"].includes(user?.plan || "FREE");
  if (supportSetupQueued) {
    await beginBusinessLearning(project.id, domain!);
    after(() => processSupportJobs().then(() => {}));
  }

  const { statuses: _statuses, ...projectRest } = project;
  return NextResponse.json(
    { ...projectRest, supportSetupQueued },
    { status: 201 },
  );
}
