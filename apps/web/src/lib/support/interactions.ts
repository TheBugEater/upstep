import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { SupportError } from "./policy";
type Client = Pick<Prisma.TransactionClient, "supportConversation">;
export async function supportInteraction(
  projectId: string,
  customerId: string,
  conversationId: string,
  client: Client = db,
) {
  const c = await client.supportConversation.findFirst({
    where: { id: conversationId, projectId, customerId },
    include: {
      customer: true,
      project: { select: { supportConfig: { select: { mode: true } } } },
      messages: {
        where: { role: { in: ["CUSTOMER", "ASSISTANT", "AGENT"] } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 1,
      },
    },
  });
  if (!c) throw new SupportError("Conversation not found.", 404);
  const latest = c.messages[0];
  const meta = latest?.metadata as {
    inScope?: boolean;
    resolution?: string;
    issueSummary?: string;
    widgets?: { id: string; type: string }[];
  } | null;
  const humanOnly =
    c.project.supportConfig?.mode === "HUMAN_ONLY" &&
    latest?.role === "CUSTOMER" &&
    latest.content.trim().length >= 10;
  const understood =
    latest?.role === "ASSISTANT" &&
    meta?.inScope === true &&
    meta.resolution === "escalate" &&
    (meta.issueSummary?.trim().length || 0) >= 10;
  const canEscalate = !!(
    c.state !== "RESOLVED" &&
    !c.aiPending &&
    (!c.humanRequested || !c.customer.name?.trim() || !c.customer.email) &&
    (understood || humanOnly)
  );
  return {
    conversation: c,
    canEscalate,
    escalationSummary: canEscalate
      ? meta?.issueSummary || latest?.content.slice(0, 240) || null
      : null,
    activeWidgetMessageId:
      latest?.role === "ASSISTANT" && !c.aiPending ? latest.id : null,
    widgets: meta?.widgets || [],
  };
}
export async function assertEscalationAllowed(
  projectId: string,
  customerId: string,
  conversationId: string,
  client: Client = db,
) {
  const context = await supportInteraction(
    projectId,
    customerId,
    conversationId,
    client,
  );
  if (context.conversation.state === "RESOLVED")
    throw new SupportError(
      "This conversation is resolved. Start a new conversation.",
      409,
    );
  if (!context.conversation.humanRequested && !context.canEscalate)
    throw new SupportError(
      "Let AI understand the issue and try to help before asking the team.",
      409,
    );
  if (
    !context.conversation.customer.name?.trim() ||
    !context.conversation.customer.email
  )
    throw new SupportError(
      "Share your name and email so the team can follow up.",
      422,
    );
  return context;
}
