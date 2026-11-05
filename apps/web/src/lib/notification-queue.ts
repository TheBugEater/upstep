import { randomUUID } from "node:crypto";
import { Prisma, NotificationJobType } from "@prisma/client";
import { db } from "./db";
import {
  sendFeedbackNotification,
  sendProjectInvitationNotification,
  type EmailNotificationPayload,
} from "./email";
import { triggerIntegrations, type IntegrationPayload } from "./integrations";
import { hashInvitationToken } from "./invitation-tokens";

type QueueClient = Pick<Prisma.TransactionClient, "notificationJob">;
type NotificationClient = Pick<Prisma.TransactionClient, "notificationJob" | "rateLimitBucket" | "projectInvitation" | "project">;
let retryTimer: NodeJS.Timeout | null = null;

export async function queueIntegration(payload: IntegrationPayload, client: QueueClient = db) {
  return client.notificationJob.create({
    data: { type: "INTEGRATION", payload: payload as unknown as Prisma.InputJsonValue },
  });
}

export async function queueEmail(payload: EmailNotificationPayload, client: QueueClient = db) {
  return client.notificationJob.create({
    data: {
      type: "EMAIL",
      payload: { ...payload, idempotencyKey: payload.idempotencyKey ?? randomUUID() } as unknown as Prisma.InputJsonValue,
    },
  });
}

export function kickNotificationProcessor() {
  void processNotificationJobs(10).catch((error) => console.error("Notification processor failed", error));
}

function scheduleRetry(delayMs: number) {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    kickNotificationProcessor();
  }, delayMs);
  retryTimer.unref();
}

export async function processNotificationJobs(limit = 25, client: NotificationClient = db) {
  const now = new Date();
  const staleLock = new Date(now.getTime() - 5 * 60_000);
  await client.notificationJob.updateMany({
    where: { status: "PROCESSING", lockedAt: { lt: staleLock } },
    data: { status: "PENDING", lockedAt: null, availableAt: now },
  });

  const jobs = await client.notificationJob.findMany({
    where: { status: "PENDING", availableAt: { lte: now } },
    orderBy: { createdAt: "asc" },
    take: Math.min(limit, 100),
  });

  let completed = 0;
  let retried = 0;
  for (const job of jobs) {
    const claimed = await client.notificationJob.updateMany({
      where: { id: job.id, status: "PENDING" },
      data: { status: "PROCESSING", lockedAt: new Date(), attempts: { increment: 1 } },
    });
    if (!claimed.count) continue;

    try {
      // Persist a key for jobs queued before SendPanda was configured, too.
      // Every retry, including recovery after a stale lock, uses the same UUID.
      if (job.type === "EMAIL") {
        const payload = job.payload as unknown as EmailNotificationPayload;
        if (!payload.idempotencyKey) {
          job.payload = { ...payload, idempotencyKey: randomUUID() } as unknown as Prisma.JsonValue;
          await client.notificationJob.update({
            where: { id: job.id },
            data: { payload: job.payload as Prisma.InputJsonValue },
          });
        }
      }
      await deliver(job.type, job.payload, client, job.id);
      await client.notificationJob.update({
        where: { id: job.id },
        data: { status: "COMPLETED", completedAt: new Date(), lockedAt: null, lastError: null },
      });
      completed++;
    } catch (error) {
      const attempts = job.attempts + 1;
      const terminal = attempts >= 5;
      await client.notificationJob.update({
        where: { id: job.id },
        data: {
          status: terminal ? "FAILED" : "PENDING",
          lockedAt: null,
          lastError: error instanceof Error ? error.message.slice(0, 2000) : String(error).slice(0, 2000),
          availableAt: new Date(Date.now() + Math.min(60, 2 ** attempts) * 60_000),
        },
      });
      if (!terminal) scheduleRetry(Math.min(60, 2 ** attempts) * 60_000 + 1_000);
      retried++;
    }
  }

  // Opportunistic cleanup keeps fixed-window buckets and successful jobs bounded.
  await Promise.all([
    client.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 60 * 60_000) } } }),
    client.notificationJob.deleteMany({
      where: { status: "COMPLETED", completedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60_000) } },
    }),
  ]);
  return { found: jobs.length, completed, retried };
}

async function deliver(type: NotificationJobType, payload: Prisma.JsonValue, client: NotificationClient, deliveryId: string) {
  if (type === "INTEGRATION") {
    await triggerIntegrations(payload as unknown as IntegrationPayload, deliveryId, client);
  } else {
    const email = payload as unknown as EmailNotificationPayload;
    if (email.kind === "PROJECT_INVITATION") {
      // A revoke, acceptance or resend makes the previous queued link obsolete.
      const active = await client.projectInvitation.findFirst({
        where: {
          id: email.invitationId, projectId: email.projectId, email: email.toEmail,
          tokenHash: hashInvitationToken(email.token),
          acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() },
        }, select: { id: true },
      });
      if (!active) return;
      await sendProjectInvitationNotification(email);
    } else {
      // Existing feedback jobs predate the kind discriminator.
      await sendFeedbackNotification(email);
    }
  }
}
