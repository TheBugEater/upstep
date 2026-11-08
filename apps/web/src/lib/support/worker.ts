import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "../db";
import {
  getSupportAIProvider,
  supportAIConfiguration,
  type SupportAIProvider,
} from "./ai";
import { processCrawlPage } from "./crawler";
import { supportLimits, usageMonth } from "./policy";

export async function knowledgeSources(
  projectId: string,
  generation: number,
  query: string,
  client: PrismaClient = db,
) {
  const stop = new Set([
    "the",
    "and",
    "for",
    "with",
    "this",
    "that",
    "what",
    "how",
    "can",
    "does",
    "you",
    "your",
    "are",
    "please",
    "help",
    "have",
    "would",
    "could",
    "about",
  ]);
  const terms = [
    ...new Set(
      (query.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []).filter(
        (t) => !stop.has(t),
      ),
    ),
  ].slice(0, 12);
  const search = terms.join(" OR ");
  const pages = await client.$queryRaw<
    { url: string; title: string; content: string }[]
  >`
    SELECT "url", "title", "content" FROM "SupportKnowledgePage"
    WHERE "projectId" = ${projectId} AND "generation" = ${generation}
    ORDER BY ts_rank(to_tsvector('simple', "title" || ' ' || "content"), websearch_to_tsquery('simple', ${search})) DESC, length("url") ASC
    LIMIT 6`;
  return pages.map((page) => {
    // Retrieve relevant passages rather than sending whole sites to the provider.
    const paragraphs = page.content
      .split(/\n\s*\n/)
      .flatMap((p) => p.match(/[\s\S]{1,1400}/g) || []);
    const scored = paragraphs.map((text, index) => ({
      text,
      index,
      score: terms.reduce(
        (n, term) => n + (text.toLowerCase().includes(term) ? 1 : 0),
        0,
      ),
    }));
    const selected = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .sort((a, b) => a.index - b.index);
    return {
      ...page,
      content: selected
        .map((p) => p.text)
        .join("\n\n")
        .slice(0, 2800),
    };
  });
}
export async function processAIConversation(
  client: PrismaClient = db,
  provider?: SupportAIProvider,
) {
  const stale = new Date(Date.now() - 2 * 60_000);
  const candidate = await client.supportConversation.findFirst({
    where: {
      aiPending: true,
      state: "AI",
      project: {
        owner: { plan: { in: ["PRO", "BUSINESS"] } },
        supportConfig: { enabled: true, mode: { not: "HUMAN_ONLY" } },
      },
      OR: [{ aiLockedAt: null }, { aiLockedAt: { lt: stale } }],
    },
    orderBy: { updatedAt: "asc" },
  });
  if (!candidate) return false;
  const lock = randomUUID();
  if (
    !(
      await client.supportConversation.updateMany({
        where: {
          id: candidate.id,
          revision: candidate.revision,
          state: "AI",
          aiPending: true,
          OR: [{ aiLockedAt: null }, { aiLockedAt: { lt: stale } }],
        },
        data: {
          aiLock: lock,
          aiLockedAt: new Date(),
          aiAttempts: { increment: 1 },
        },
      })
    ).count
  )
    return false;
  const c = await client.supportConversation.findUniqueOrThrow({
    where: { id: candidate.id },
    include: {
      project: {
        include: { owner: { select: { plan: true } }, supportConfig: true },
      },
      messages: {
        where: { role: { in: ["CUSTOMER", "ASSISTANT", "AGENT"] } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 20,
      },
    },
  });
  const config = c.project.supportConfig!;
  const month = usageMonth();
  const lastCustomer = c.messages.find((m) => m.role === "CUSTOMER");
  try {
    if (!lastCustomer) {
      await client.supportConversation.updateMany({
        where: { id: c.id, aiLock: lock, revision: candidate.revision },
        data: { aiPending: false },
      });
      return true;
    }
    if (!provider && !supportAIConfiguration().ready)
      throw new Error("AI is not configured. The team can reply here.");
    // An atomic reservation prevents simultaneous conversations exceeding the account allowance.
    await client.supportUsage.upsert({
      where: { ownerId_month: { ownerId: c.project.ownerId, month } },
      create: { ownerId: c.project.ownerId, month },
      update: {},
    });
    const usage = await client.supportUsage.updateMany({
      where: {
        ownerId: c.project.ownerId,
        month,
        aiReplies: { lt: supportLimits(c.project.owner.plan).aiReplies },
      },
      data: { aiReplies: { increment: 1 } },
    });
    if (!usage.count)
      throw new Error(
        "The AI allowance has been reached. The team can reply here.",
      );
    const sources = await knowledgeSources(
      c.projectId,
      config.crawlGeneration,
      lastCustomer.content,
      client,
    );
    const result = await (provider || getSupportAIProvider()).reply({
      businessName: config.businessName,
      welcomeMessage: config.welcomeMessage,
      sources,
      messages: [...c.messages]
        .reverse()
        .map((m) => ({ role: m.role, content: m.content })),
    });
    await client.$transaction(async (tx) => {
      // Fence against customer messages, human takeover, disable, and configuration changes during generation.
      const current = await tx.supportConversation.updateMany({
        where: {
          id: c.id,
          aiLock: lock,
          revision: candidate.revision,
          state: "AI",
          project: {
            supportConfig: {
              enabled: true,
              crawlGeneration: config.crawlGeneration,
              mode: { not: "HUMAN_ONLY" },
            },
            owner: { plan: { in: ["PRO", "BUSINESS"] } },
          },
        },
        data: {
          aiPending: false,
          aiLock: null,
          aiLockedAt: null,
          aiError: null,
          ...(result.handoff ? { state: "WAITING", humanRequested: true } : {}),
        },
      });
      if (!current.count) return;
      const citations = [...new Set(result.sources)]
        .filter((i) => i >= 0 && i < sources.length)
        .map((i) => ({ url: sources[i]!.url, title: sources[i]!.title }));
      await tx.supportMessage.upsert({
        where: {
          conversationId_clientMessageId: {
            conversationId: c.id,
            clientMessageId: `ai:${lastCustomer.id}`,
          },
        },
        create: {
          conversationId: c.id,
          clientMessageId: `ai:${lastCustomer.id}`,
          role: "ASSISTANT",
          authorName: `${config.businessName} AI`,
          content: result.reply,
          metadata: {
            citations,
            offerTicket: result.offerTicket,
            ticketTitle: result.ticketTitle,
            ticketType: result.ticketType,
          } as Prisma.InputJsonValue,
        },
        update: {},
      });
    });
  } catch (error) {
    const known =
      error instanceof Error &&
      /^(AI is not configured|The AI allowance)/.test(error.message);
    const message = known
      ? (error as Error).message
      : "The AI assistant couldn't reply. Your message is saved for the team.";
    await client.$transaction(async (tx) => {
      const changed = await tx.supportConversation.updateMany({
        where: {
          id: c.id,
          aiLock: lock,
          revision: candidate.revision,
          state: "AI",
        },
        data: {
          aiPending: false,
          state: "WAITING",
          aiError: message,
          aiLock: null,
          aiLockedAt: null,
        },
      });
      if (changed.count)
        await tx.supportMessage.upsert({
          where: {
            conversationId_clientMessageId: {
              conversationId: c.id,
              clientMessageId: `ai-error:${lastCustomer?.id || c.revision}`,
            },
          },
          create: {
            conversationId: c.id,
            clientMessageId: `ai-error:${lastCustomer?.id || c.revision}`,
            role: "SYSTEM",
            authorName: `${config.businessName} Team`,
            content: message,
          },
          update: {},
        });
    });
  } finally {
    // Leave pending=true when a newer visitor message invalidated this generation.
    await client.supportConversation.updateMany({
      where: { id: c.id, aiLock: lock },
      data: { aiLock: null, aiLockedAt: null },
    });
  }
  return true;
}
let running = false;
export async function processSupportJobs(budgetMs = 25_000) {
  if (running) return { busy: true, ai: 0, pages: 0 };
  running = true;
  let ai = 0,
    pages = 0;
  const deadline = Date.now() + budgetMs;
  try {
    await db.supportConversation.updateMany({
      where: {
        state: "WAITING",
        humanRequested: false,
        assignedToId: null,
        updatedAt: { lt: new Date(Date.now() - 60_000) },
        messages: { some: { role: "CUSTOMER" } },
        project: {
          supportConfig: { enabled: true, mode: "HUMAN_FIRST" },
          owner: { plan: { in: ["PRO", "BUSINESS"] } },
        },
      },
      data: { state: "AI", aiPending: true, revision: { increment: 1 } },
    });
    const refresh = await db.supportConfig.findFirst({
      where: {
        enabled: true,
        crawlState: "READY",
        crawledAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60_000) },
        project: { owner: { plan: { in: ["PRO", "BUSINESS"] } } },
      },
    });
    if (refresh)
      await db.supportConfig.updateMany({
        where: {
          projectId: refresh.projectId,
          crawlGeneration: refresh.crawlGeneration,
          crawlState: "READY",
        },
        data: {
          crawlState: "QUEUED",
          crawlQueue: [],
          crawlVisited: [],
          crawlError: null,
          crawlGeneration: { increment: 1 },
        },
      });
    while (Date.now() < deadline) {
      if (await processAIConversation()) {
        ai++;
        continue;
      }
      if (Date.now() + 8000 > deadline || !(await processCrawlPage())) break;
      pages++;
    }
    return { ai, pages };
  } finally {
    running = false;
  }
}
