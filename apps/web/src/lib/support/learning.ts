import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Prisma, type PrismaClient } from "@prisma/client";
import { db } from "../db";
import { collaborationTransaction } from "../project-collaboration";
import { normalizeDomain } from "./crawler";
import {
  getSupportAIProvider,
  supportAIConfiguration,
  type SupportAIProvider,
} from "./ai";
import { supportProject } from "./service";
import { SupportError, supportLimits, usageMonth } from "./policy";
import { learningSchema } from "./learning-types";

export async function beginBusinessLearning(
  projectId: string,
  website: string,
  client: PrismaClient = db,
) {
  const domain = normalizeDomain(website);
  return collaborationTransaction(async (tx) => {
    await supportProject(projectId, tx);
    const previous = await tx.supportConfig.findUnique({
      where: { projectId },
    });
    if (previous?.domain === domain && previous.learningState === "LEARNING")
      return previous;
    if (
      previous?.domain === domain &&
      previous.learningState === "FAILED" &&
      previous.crawlState === "READY"
    )
      return tx.supportConfig.update({
        where: { projectId },
        data: {
          learningState: "LEARNING",
          learningGeneration: previous.crawlGeneration,
          learningLock: null,
          learningLockedAt: null,
          learningError: null,
        },
      });
    if (
      previous?.learningLockedAt &&
      Date.now() - previous.learningLockedAt.getTime() < 60_000
    )
      throw new SupportError(
        "Website learning is still running. Please wait a moment.",
        429,
      );
    if (
      previous?.crawledAt &&
      Date.now() - previous.crawledAt.getTime() < 60_000 &&
      previous.learningState !== "NEW"
    )
      throw new SupportError(
        "Please wait a minute before learning the website again.",
        429,
      );
    const generation = (previous?.crawlGeneration || 0) + 1;
    const changed = previous && previous.domain !== domain;
    const update = {
      domain,
      crawlGeneration: generation,
      crawlState: "QUEUED",
      crawlQueue: [] as string[],
      crawlVisited: [] as string[],
      crawlError: null,
      crawlLock: null,
      crawlLockedAt: null,
      crawledAt: null,
      learningState: "LEARNING",
      learningGeneration: generation,
      learningAnalysis: Prisma.DbNull,
      learningLock: null,
      learningLockedAt: null,
      learningError: null,
    };
    const config = await tx.supportConfig.upsert({
      where: { projectId },
      create: { projectId, businessName: domain, enabled: false, ...update },
      update: {
        ...update,
        ...(changed
          ? {
              enabled: false,
              businessName: domain,
              supportEmail: null,
              businessSummary: null,
              agentInstructions: null,
              businessProfile: Prisma.DbNull,
            }
          : {}),
      },
    });
    if (changed)
      await tx.supportConversation.updateMany({
        where: { projectId, state: "AI" },
        data: {
          state: "WAITING",
          aiPending: false,
          aiLock: null,
          aiLockedAt: null,
          revision: { increment: 1 },
        },
      });
    return config;
  }, client);
}
export const reviewSchema = z.object({
  generation: z.number().int().min(1),
  businessName: z.string().trim().min(1).max(80),
  supportEmail: z.string().trim().email().max(254),
  summary: z.string().trim().min(10).max(4000),
  instructions: z.string().trim().min(10).max(2000),
  facts: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(80),
        value: z.string().trim().min(1).max(500),
      }),
    )
    .max(6)
    .default([]),
  answers: z
    .record(z.string().trim().max(1000))
    .refine((x) => Object.keys(x).length <= 3)
    .default({}),
  mode: z.enum(["AI_FIRST", "HUMAN_FIRST", "HUMAN_ONLY"]).default("AI_FIRST"),
  welcomeMessage: z.string().trim().min(1).max(500),
  enabled: z.boolean().default(true),
});
export async function confirmBusinessLearning(
  projectId: string,
  input: z.infer<typeof reviewSchema>,
  client: PrismaClient = db,
) {
  return collaborationTransaction(async (tx) => {
    await supportProject(projectId, tx);
    const config = await tx.supportConfig.findUnique({ where: { projectId } });
    if (!config || input.generation !== config.crawlGeneration)
      throw new SupportError(
        "The website changed. Reload the latest review before continuing.",
        409,
      );
    if (config.learningState === "LEARNING")
      throw new SupportError(
        "Wait for website learning to finish before reviewing.",
        409,
      );
    const analysis = learningSchema.safeParse(config.learningAnalysis);
    const questions = analysis.success ? analysis.data.questions : [];
    const answers = questions.map((q) => ({
      question: q.question,
      answer: input.answers[q.id] || "",
    }));
    if (answers.some((a) => !a.answer.trim()))
      throw new SupportError(
        "Answer the review questions, or say when you don't know yet.",
      );
    await tx.supportConfig.update({
      where: { projectId },
      data: {
        businessName: input.businessName,
        supportEmail: input.supportEmail.toLowerCase(),
        businessSummary: input.summary,
        agentInstructions: input.instructions,
        businessProfile: { facts: input.facts, answers },
        mode: input.mode,
        welcomeMessage: input.welcomeMessage,
        enabled: input.enabled,
        learningState: "READY",
        learningError: null,
      },
    });
    if (!input.enabled || input.mode === "HUMAN_ONLY")
      await tx.supportConversation.updateMany({
        where: { projectId, state: "AI" },
        data: {
          state: "WAITING",
          aiPending: false,
          aiLock: null,
          aiLockedAt: null,
          revision: { increment: 1 },
        },
      });
  }, client);
}
export async function processBusinessLearning(
  client: PrismaClient = db,
  provider?: SupportAIProvider,
  projectId?: string,
) {
  const stale = new Date(Date.now() - 2 * 60_000);
  const config = await client.supportConfig.findFirst({
    where: {
      ...(projectId ? { projectId } : {}),
      learningState: "LEARNING",
      crawlState: { in: ["READY", "FAILED"] },
      project: { owner: { plan: { in: ["PRO", "BUSINESS"] } } },
      OR: [{ learningLockedAt: null }, { learningLockedAt: { lt: stale } }],
    },
    include: {
      project: { select: { ownerId: true, owner: { select: { plan: true } } } },
    },
    orderBy: { updatedAt: "asc" },
  });
  if (!config) return false;
  const lock = randomUUID();
  if (
    !(
      await client.supportConfig.updateMany({
        where: {
          projectId: config.projectId,
          learningState: "LEARNING",
          learningGeneration: config.learningGeneration,
          crawlGeneration: config.crawlGeneration,
          OR: [{ learningLockedAt: null }, { learningLockedAt: { lt: stale } }],
        },
        data: { learningLock: lock, learningLockedAt: new Date() },
      })
    ).count
  )
    return false;
  try {
    const pages = await client.supportKnowledgePage.findMany({
      where: {
        projectId: config.projectId,
        generation: config.crawlGeneration,
      },
      select: { url: true, title: true, content: true },
      take: supportLimits(config.project.owner.plan).pages,
    });
    if (!pages.length)
      throw new Error(
        "No readable website pages were found. You can add the business details manually below.",
      );
    if (!provider && !supportAIConfiguration().ready)
      throw new Error(
        "Website pages were indexed, but AI isn't configured. Complete the review manually or try again later.",
      );
    const month = usageMonth();
    await client.supportUsage.upsert({
      where: { ownerId_month: { ownerId: config.project.ownerId, month } },
      create: { ownerId: config.project.ownerId, month },
      update: {},
    });
    if (
      !(
        await client.supportUsage.updateMany({
          where: {
            ownerId: config.project.ownerId,
            month,
            learningCalls: {
              lt: supportLimits(config.project.owner.plan).learningRuns,
            },
          },
          data: { learningCalls: { increment: 1 } },
        })
      ).count
    )
      throw new Error(
        "This month's website learning allowance has been reached. You can complete the review manually.",
      );
    const sources = pages
      .sort((a, b) => {
        const rank = (url: string) =>
          /about|contact|support|pricing|faq|service|policy|return|features/i.test(
            url,
          )
            ? 0
            : new URL(url).pathname === "/"
              ? -1
              : 1;
        return rank(a.url) - rank(b.url) || a.url.length - b.url.length;
      })
      .slice(0, 16)
      .map((p) => ({ ...p, content: p.content.slice(0, 2600) }));
    const ai = provider || getSupportAIProvider();
    if (!ai.learn)
      throw new Error(
        "The configured AI provider doesn't support website learning. Complete the review manually.",
      );
    const result = learningSchema.parse(
      await ai.learn({ domain: config.domain, sources }),
    );
    const allowed = new Set(sources.map((s) => s.url));
    result.facts = result.facts
      .map((f) => ({
        ...f,
        sources: f.sources.filter((url) => allowed.has(url)),
      }))
      .filter((f) => f.sources.length > 0);
    if (
      result.supportEmail &&
      !sources.some((s) =>
        s.content.toLowerCase().includes(result.supportEmail!.toLowerCase()),
      )
    )
      result.supportEmail = null;
    result.questions = result.questions
      .slice(0, 3)
      .map((q, i) => ({ ...q, id: `question_${i + 1}` }));
    await client.supportConfig.updateMany({
      where: {
        projectId: config.projectId,
        crawlGeneration: config.crawlGeneration,
        learningGeneration: config.learningGeneration,
        learningLock: lock,
        project: { owner: { plan: { in: ["PRO", "BUSINESS"] } } },
      },
      data: {
        learningState: "REVIEW",
        learningAnalysis: result as Prisma.InputJsonValue,
        learningLock: null,
        learningLockedAt: null,
        learningError: null,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error &&
      /^(No readable|Website pages|This month's|The configured)/.test(
        error.message,
      )
        ? error.message
        : "The website was indexed, but the AI review couldn't be completed. Add the details manually or try again.";
    await client.supportConfig.updateMany({
      where: { projectId: config.projectId, learningLock: lock },
      data: {
        learningState: "FAILED",
        learningLock: null,
        learningLockedAt: null,
        learningError: message,
      },
    });
  }
  return true;
}
