import { db } from "../db";
import { collaborationTransaction } from "../project-collaboration";
import { SupportError, supportLimits } from "./policy";
import { supportProject } from "./service";

export async function getSupportKnowledge(projectId: string) {
  const { supportConfig: config, owner } = await supportProject(projectId);
  const pageLimit = supportLimits(owner.plan).pages;
  if (!config) return { config: null, pages: [], pageLimit };
  const pages = await db.supportKnowledgePage.findMany({
    where: { projectId, generation: config.crawlGeneration },
    select: { url: true, title: true, indexedAt: true },
    orderBy: { url: "asc" },
    take: pageLimit,
  });
  return {
    config: {
      domain: config.domain,
      enabled: config.enabled,
      businessName: config.businessName,
      mode: config.mode,
      welcomeMessage: config.welcomeMessage,
      supportEmail: config.supportEmail,
      summary: config.businessSummary,
      instructions: config.agentInstructions,
      profile: config.businessProfile,
      generation: config.crawlGeneration,
      crawlState: config.crawlState,
      crawlError: config.crawlError,
      crawledAt: config.crawledAt,
      learningState: config.learningState,
      learningError: config.learningError,
      findings: config.learningAnalysis,
    },
    pages,
    pageLimit,
  };
}

export async function queueKnowledgeRefresh(projectId: string) {
  return collaborationTransaction(async (tx) => {
    const { supportConfig: config } = await supportProject(projectId, tx);
    if (!config?.enabled) throw new SupportError("Enable support before indexing.");
    if (["CRAWLING", "QUEUED"].includes(config.crawlState))
      return { queued: true, generation: config.crawlGeneration };
    if (config.learningState === "LEARNING")
      throw new SupportError("Wait for website learning to finish before refreshing.", 409);
    if (config.crawledAt && Date.now() - config.crawledAt.getTime() < 5 * 60_000)
      throw new SupportError("Wait five minutes before refreshing again.", 429);

    const { crawlGeneration } = await tx.supportConfig.update({
      where: { projectId },
      data: {
        crawlState: "QUEUED",
        crawlQueue: [],
        crawlVisited: [],
        crawlError: null,
        crawlGeneration: { increment: 1 },
        crawlLock: null,
        crawlLockedAt: null,
      },
      select: { crawlGeneration: true },
    });
    return { queued: true, generation: crawlGeneration };
  });
}
