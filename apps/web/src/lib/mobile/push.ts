import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { getProjectAccess } from "../project-auth";
import { getSiteUrl } from "../site-url";

export type SupportPushEvent = {
  eventId: string;
  projectId: string;
  conversationId: string;
  kind: "HUMAN_REQUEST" | "CUSTOMER_MESSAGE" | "ASSIGNED" | "AI_FAILED";
  recipientId?: string;
  occurredAt: string;
};
export type PushClient = Pick<
  Prisma.TransactionClient,
  | "supportConversation"
  | "supportPushPreference"
  | "mobileDevice"
  | "supportRead"
  | "supportPushDelivery"
  | "project"
>;

export async function queueSupportPush(
  event: SupportPushEvent,
  client: Pick<Prisma.TransactionClient, "notificationJob">,
) {
  await client.notificationJob.create({
    data: { type: "PUSH", payload: event as unknown as Prisma.InputJsonValue },
  });
}

export class PushDeliveryError extends Error {
  constructor(
    message: string,
    public retryable: boolean,
  ) {
    super(message);
  }
}
const providerHeaders = () => ({
  "Content-Type": "application/json",
  ...(process.env.EXPO_ACCESS_TOKEN
    ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
    : {}),
});

// At-least-once provider delivery: remember accepted tickets before retrying an event.
// A crash between provider acceptance and persistence can still produce a duplicate.
export async function deliverSupportPush(
  event: SupportPushEvent,
  client: PushClient = db,
  transport: typeof fetch = fetch,
) {
  const conversation = await client.supportConversation.findFirst({
    where: { id: event.conversationId, projectId: event.projectId },
    include: {
      project: {
        include: { owner: { select: { plan: true } }, supportConfig: true },
      },
    },
  });
  if (
    !conversation ||
    conversation.state === "RESOLVED" ||
    !conversation.project.supportConfig?.enabled ||
    !["PRO", "BUSINESS"].includes(conversation.project.owner.plan)
  )
    return;
  if (
    event.kind === "ASSIGNED" &&
    conversation.assignedToId !== event.recipientId
  )
    return;
  if (
    event.kind === "HUMAN_REQUEST" &&
    (!conversation.humanRequested || conversation.state === "HUMAN")
  )
    return;
  if (event.kind === "AI_FAILED" && !conversation.aiError) return;
  if (
    event.kind === "CUSTOMER_MESSAGE" &&
    conversation.state === "AI" &&
    !conversation.humanRequested
  )
    return;
  const now = new Date();
  const preferences = await client.supportPushPreference.findMany({
    where: {
      projectId: event.projectId,
      enabled: true,
      ...(conversation.assignedToId
        ? { userId: conversation.assignedToId }
        : { onCall: true }),
      OR: [{ quietUntil: null }, { quietUntil: { lte: now } }],
    },
  });
  for (const preference of preferences) {
    if (!(await getProjectAccess(event.projectId, preference.userId, client)))
      continue;
    const read = await client.supportRead.findUnique({
      where: {
        userId_conversationId: {
          userId: preference.userId,
          conversationId: conversation.id,
        },
      },
    });
    if (read && read.readAt >= new Date(event.occurredAt)) continue;
    const devices = await client.mobileDevice.findMany({
      where: {
        enabled: true,
        session: {
          userId: preference.userId,
          revokedAt: null,
          expiresAt: { gt: now },
        },
      },
    });
    for (const device of devices) {
      if (
        device.activeConversationId === conversation.id &&
        device.lastActiveAt &&
        now.getTime() - device.lastActiveAt.getTime() < 60_000
      )
        continue;
      const delivery = await client.supportPushDelivery.upsert({
        where: {
          eventId_deviceId: { eventId: event.eventId, deviceId: device.id },
        },
        create: { eventId: event.eventId, deviceId: device.id },
        update: {},
      });
      if (delivery.ticketId || delivery.receiptCheckedAt) continue;
      const response = await transport("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: providerHeaders(),
        signal: AbortSignal.timeout(10_000),
        body: JSON.stringify({
          to: device.pushToken,
          title: conversation.project.name,
          body:
            event.kind === "CUSTOMER_MESSAGE"
              ? "A customer replied to a support conversation."
              : "A customer needs your help.",
          sound: "default",
          channelId: "support",
          ttl: 3600,
          data: {
            serverUrl: new URL(process.env.AUTH_URL || getSiteUrl()).origin,
            projectId: event.projectId,
            conversationId: conversation.id,
          },
        }),
      });
      if (!response.ok)
        throw new PushDeliveryError(
          `Push provider HTTP ${response.status}`,
          response.status === 429 || response.status >= 500,
        );
      const result = (await response.json()) as {
        data?: { status?: string; id?: string; details?: { error?: string } };
      };
      const ticket = result.data;
      if (ticket?.status === "ok" && ticket.id) {
        await client.supportPushDelivery.update({
          where: { id: delivery.id },
          data: { ticketId: ticket.id, lastError: null },
        });
        await client.mobileDevice.update({
          where: { id: device.id },
          data: { lastNotifiedAt: now },
        });
      } else {
        const error =
          ticket?.details?.error || "Invalid push provider response";
        if (error === "DeviceNotRegistered") {
          await client.mobileDevice.update({
            where: { id: device.id },
            data: { enabled: false },
          });
          await client.supportPushDelivery.update({
            where: { id: delivery.id },
            data: { lastError: error, receiptCheckedAt: now },
          });
        } else
          throw new PushDeliveryError(
            error,
            error === "MessageRateExceeded" || !ticket,
          );
      }
    }
  }
}

export async function processPushReceipts(
  client: Pick<
    Prisma.TransactionClient,
    "supportPushDelivery" | "mobileDevice"
  > = db,
  transport: typeof fetch = fetch,
) {
  const pending = await client.supportPushDelivery.findMany({
    where: {
      ticketId: { not: null },
      receiptCheckedAt: null,
      createdAt: { lt: new Date(Date.now() - 15 * 60_000) },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  if (!pending.length) return 0;
  const response = await transport(
    "https://exp.host/--/api/v2/push/getReceipts",
    {
      method: "POST",
      headers: providerHeaders(),
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({ ids: pending.map((p) => p.ticketId) }),
    },
  );
  if (!response.ok) return 0;
  const result = (await response.json()) as {
    data?: Record<string, { status?: string; details?: { error?: string } }>;
  };
  let checked = 0;
  for (const item of pending) {
    const receipt = result.data?.[item.ticketId!];
    if (!receipt && item.createdAt.getTime() > Date.now() - 24 * 60 * 60_000)
      continue;
    const error =
      receipt?.status === "ok"
        ? null
        : receipt?.details?.error || "Push receipt unavailable";
    if (error === "DeviceNotRegistered")
      await client.mobileDevice.updateMany({
        where: { id: item.deviceId },
        data: { enabled: false },
      });
    await client.supportPushDelivery.update({
      where: { id: item.id },
      data: { receiptCheckedAt: new Date(), lastError: error },
    });
    checked++;
  }
  return checked;
}
