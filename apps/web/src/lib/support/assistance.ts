import { db } from "../db";
import { supportTeamAccess } from "./service";
import { knowledgeSources } from "./worker";
import {
  getSupportAIProvider,
  supportAIConfiguration,
  type SupportAIProvider,
} from "./ai";
import { SupportError, supportLimits, usageMonth } from "./policy";

export async function assistConversation(
  projectId: string,
  conversationId: string,
  actorId: string,
  intent: "summary" | "draft",
  client = db,
  provider?: SupportAIProvider,
) {
  await supportTeamAccess(projectId, actorId, false, client);
  const c = await client.supportConversation.findFirst({
    where: { id: conversationId, projectId },
    include: {
      project: {
        include: { owner: { select: { plan: true } }, supportConfig: true },
      },
      messages: {
        where: { role: { in: ["CUSTOMER", "AGENT", "ASSISTANT"] } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 20,
      },
    },
  });
  if (!c) throw new SupportError("Conversation not found.", 404);
  if (intent === "draft" && (c.state !== "HUMAN" || c.assignedToId !== actorId))
    throw new SupportError(
      "Take over the conversation before drafting a reply.",
      409,
    );
  const config = c.project.supportConfig;
  if (!config?.enabled || (!provider && !supportAIConfiguration().ready))
    throw new SupportError("AI assistance is not configured.", 503);
  const ai = provider || getSupportAIProvider();
  if (!ai.assist)
    throw new SupportError(
      "This AI provider does not support teammate assistance.",
      503,
    );
  const month = usageMonth();
  await client.supportUsage.upsert({
    where: { ownerId_month: { ownerId: c.project.ownerId, month } },
    create: { ownerId: c.project.ownerId, month },
    update: {},
  });
  const reserved = await client.supportUsage.updateMany({
    where: {
      ownerId: c.project.ownerId,
      month,
      aiReplies: { lt: supportLimits(c.project.owner.plan).aiReplies },
    },
    data: { aiReplies: { increment: 1 } },
  });
  if (!reserved.count)
    throw new SupportError(
      "The AI allowance has been reached. You can still reply yourself.",
      402,
    );
  const sources = await knowledgeSources(
    projectId,
    config.crawlGeneration,
    c.messages.find((m) => m.role === "CUSTOMER")?.content || "",
    client,
  );
  const answer = await ai.assist({
    intent,
    businessName: config.businessName,
    businessSummary: config.businessSummary || "",
    businessProfile:
      config.businessProfile &&
      typeof config.businessProfile === "object" &&
      !Array.isArray(config.businessProfile)
        ? {
            facts: config.businessProfile.facts || [],
            answers: config.businessProfile.answers || [],
          }
        : null,
    sources,
    messages: [...c.messages]
      .reverse()
      .map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content.slice(0, 4000),
      })),
  });
  await supportTeamAccess(projectId, actorId, false, client);
  const current = await client.supportConversation.findUnique({
    where: { id: c.id },
    select: { revision: true },
  });
  if (current?.revision !== c.revision)
    throw new SupportError(
      "The conversation changed. Refresh before asking AI again.",
      409,
    );
  return {
    text: answer.text,
    revision: c.revision,
    messageIds: answer.messageIds.filter((id) =>
      c.messages.some((m) => m.id === id),
    ),
    citations: answer.sources
      .filter((i) => i >= 0 && i < sources.length)
      .map((i) => ({ url: sources[i]!.url, title: sources[i]!.title })),
  };
}
