import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getProjectAccess } from "@/lib/project-auth";
import { supportResponseError, teamRequest } from "@/lib/support/http";
import { normalizeDomain } from "@/lib/support/crawler";
import { identitySecret } from "@/lib/support/identity";
import {
  supportLimits,
  SUPPORT_MODES,
  SupportError,
} from "@/lib/support/policy";
import {
  availableAgents,
  supportProject,
  supportUsage,
} from "@/lib/support/service";
import { processSupportJobs } from "@/lib/support/worker";
import { supportAIConfiguration } from "@/lib/support/ai";

type Context = { params: Promise<{ id: string }> };
export async function GET(req: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) throw new SupportError("Unauthorized", 401);
    const access = await getProjectAccess(id, session.user.id);
    if (!access) throw new SupportError("Not found.", 404);
    const project = await db.project.findUniqueOrThrow({
      where: { id },
      include: { owner: { select: { plan: true } }, supportConfig: true },
    });
    const limits = supportLimits(project.owner.plan);
    if (!limits.enabled)
      return NextResponse.json(
        { paid: false, limits },
        { headers: { "Cache-Control": "no-store" } },
      );
    const config = project.supportConfig;
    const [conversations, online, presence, pages, usage] = await Promise.all([
      db.supportConversation.findMany({
        where: { projectId: id },
        include: {
          customer: true,
          assignee: { select: { id: true, name: true } },
          messages: {
            where: { role: { not: "NOTE" } },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
      availableAgents(id),
      db.supportPresence.findUnique({
        where: { projectId_userId: { projectId: id, userId: session.user.id } },
      }),
      config
        ? db.supportKnowledgePage.findMany({
            where: { projectId: id, generation: config.crawlGeneration },
            select: { url: true, title: true, indexedAt: true },
            take: 150,
          })
        : [],
      supportUsage(project.ownerId, project.owner.plan),
    ]);
    return NextResponse.json(
      {
        paid: true,
        config: config
          ? {
              enabled: config.enabled,
              domain: config.domain,
              businessName: config.businessName,
              mode: config.mode,
              welcomeMessage: config.welcomeMessage,
              crawlState: config.crawlState,
              crawlError: config.crawlError,
              crawledAt: config.crawledAt,
            }
          : null,
        limits,
        conversations,
        online,
        available: presence?.available ?? false,
        pages,
        usage,
        ai: supportAIConfiguration(),
        canManage: access.canManage,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return supportResponseError(e);
  }
}
const configSchema = z.object({
  domain: z.string().trim().min(3).max(253),
  businessName: z.string().trim().max(80).default(""),
  enabled: z.boolean(),
  mode: z.enum(SUPPORT_MODES),
  welcomeMessage: z.string().trim().min(1).max(500),
});
export async function PUT(req: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    await teamRequest(req, id, true);
    const parsed = configSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success)
      throw new SupportError(
        "Enter a domain, business name and welcome message.",
      );
    const domain = normalizeDomain(parsed.data.domain);
    const settings = {
      ...parsed.data,
      businessName: parsed.data.businessName || domain,
    };
    await db.$transaction(async (tx) => {
      const previous = await tx.supportConfig.findUnique({
        where: { projectId: id },
      });
      const reset = previous && previous.domain !== domain;
      await tx.supportConfig.upsert({
        where: { projectId: id },
        create: { projectId: id, ...settings, domain },
        update: {
          ...settings,
          domain,
          ...(reset
            ? {
                crawlState: "QUEUED",
                crawlQueue: [],
                crawlVisited: [],
                crawlError: null,
                crawlGeneration: { increment: 1 },
                crawlLock: null,
                crawlLockedAt: null,
                crawledAt: null,
              }
            : {}),
        },
      });
      if (!parsed.data.enabled || parsed.data.mode === "HUMAN_ONLY" || reset)
        await tx.supportConversation.updateMany({
          where: { projectId: id, state: "AI" },
          data: {
            state: "WAITING",
            aiPending: false,
            aiLock: null,
            aiLockedAt: null,
            revision: { increment: 1 },
          },
        });
    });
    after(() => processSupportJobs().then(() => {}));
    return NextResponse.json({ saved: true });
  } catch (e) {
    return supportResponseError(e);
  }
}
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("presence"), available: z.boolean() }),
  z.object({ action: z.literal("crawl") }),
  z.object({ action: z.literal("identity") }),
]);
export async function POST(req: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    const parsed = actionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new SupportError("Invalid support action.");
    const { userId, access } = await teamRequest(
      req,
      id,
      parsed.data.action === "crawl",
    );
    if (parsed.data.action === "presence") {
      await db.supportPresence.upsert({
        where: { projectId_userId: { projectId: id, userId } },
        create: { projectId: id, userId, available: parsed.data.available },
        update: { available: parsed.data.available, lastSeenAt: new Date() },
      });
      return NextResponse.json({ saved: true });
    }
    if (parsed.data.action === "identity") {
      if (!access.isOwner)
        throw new SupportError(
          "Only the owner can access the identity signing secret.",
          403,
        );
      return NextResponse.json(
        { secret: identitySecret(id) },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const project = await supportProject(id);
    const config = project.supportConfig;
    if (!config?.enabled)
      throw new SupportError("Enable support before indexing.");
    if (["CRAWLING", "QUEUED"].includes(config.crawlState)) {
      after(() => processSupportJobs().then(() => {}));
      return NextResponse.json({ queued: true });
    }
    if (
      config.crawledAt &&
      Date.now() - config.crawledAt.getTime() < 5 * 60_000
    )
      throw new SupportError("Wait five minutes before refreshing again.", 429);
    await db.supportConfig.updateMany({
      where: { projectId: id, crawlGeneration: config.crawlGeneration },
      data: {
        crawlState: "QUEUED",
        crawlQueue: [],
        crawlVisited: [],
        crawlError: null,
        crawlGeneration: { increment: 1 },
        crawlLock: null,
        crawlLockedAt: null,
      },
    });
    after(() => processSupportJobs().then(() => {}));
    return NextResponse.json({ queued: true });
  } catch (e) {
    return supportResponseError(e);
  }
}
