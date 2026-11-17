import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { supportTeamAccess } from "../support/service";
import { SupportError } from "../support/policy";

export const INBOX_FILTERS = ["needs_human", "mine", "ai", "resolved"] as const;
export type InboxFilter = (typeof INBOX_FILTERS)[number];
export async function mobileInbox(
  projectId: string,
  userId: string,
  filter: InboxFilter,
  cursor?: string,
  client = db,
) {
  await supportTeamAccess(projectId, userId, false, client);
  let before: { at: string; id: string } | null = null;
  if (cursor) {
    try {
      before = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
      if (
        !before ||
        typeof before.at !== "string" ||
        typeof before.id !== "string" ||
        before.id.length > 128 ||
        !Number.isFinite(Date.parse(before.at))
      )
        throw new Error();
    } catch {
      throw new SupportError("Invalid inbox cursor.");
    }
  }
  const state: Prisma.SupportConversationWhereInput =
    filter === "needs_human"
      ? { OR: [{ state: "WAITING" }, { state: "AI", humanRequested: true }] }
      : filter === "mine"
        ? { state: "HUMAN", assignedToId: userId }
        : filter === "ai"
          ? { state: "AI", humanRequested: false }
          : { state: "RESOLVED" };
  const conversations = await client.supportConversation.findMany({
    where: {
      projectId,
      AND: [
        state,
        ...(before
          ? [
              {
                OR: [
                  { updatedAt: { lt: new Date(before.at) } },
                  { updatedAt: new Date(before.at), id: { lt: before.id } },
                ],
              },
            ]
          : []),
      ],
    },
    include: {
      customer: { select: { name: true, email: true, verified: true } },
      assignee: { select: { id: true, name: true } },
      messages: {
        where: { role: "CUSTOMER" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 1,
      },
      reads: { where: { userId }, select: { readAt: true } },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: 31,
  });
  const page = conversations.slice(0, 30);
  const last = page.at(-1);
  return {
    conversations: page.map(({ reads, ...c }) => ({
      ...c,
      unread:
        !!c.messages[0] &&
        (!reads[0] || c.messages[0].createdAt > reads[0].readAt),
    })),
    nextCursor:
      conversations.length > 30 && last
        ? Buffer.from(
            JSON.stringify({ at: last.updatedAt.toISOString(), id: last.id }),
          ).toString("base64url")
        : null,
  };
}

export async function markConversationRead(
  projectId: string,
  conversationId: string,
  userId: string,
  messageId: string,
  client = db,
) {
  await supportTeamAccess(projectId, userId, false, client);
  const message = await client.supportMessage.findFirst({
    where: {
      id: messageId,
      conversationId,
      conversation: { projectId },
    },
  });
  if (!message) throw new SupportError("Message not found.", 404);
  await client.supportRead.upsert({
    where: { userId_conversationId: { userId, conversationId } },
    create: { userId, conversationId, readAt: message.createdAt },
    update: {},
  });
  await client.supportRead.updateMany({
    where: { userId, conversationId, readAt: { lt: message.createdAt } },
    data: { readAt: message.createdAt },
  });
}
