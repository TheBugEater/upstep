import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { db } from "./db";
import { getProjectAccess } from "./project-auth";
import { collaborationTransaction, CollaborationError } from "./project-collaboration";
import type { IntegrationPayload } from "./integrations";

export function discussionJobId(integrationId: string, feedbackId: string) {
  return "chat-discussion-" + createHash("sha256").update(JSON.stringify([integrationId, feedbackId])).digest("hex");
}

export async function startGoogleChatDiscussion(input: { projectId: string; feedbackId: string; integrationId: string; actorId: string }, client: PrismaClient = db) {
  return collaborationTransaction(async (tx) => {
    if (!await getProjectAccess(input.projectId, input.actorId, tx)) throw new CollaborationError("Task not found.", 404);
    const project = await tx.project.findUnique({ where: { id: input.projectId }, select: { name: true, owner: { select: { plan: true } } } });
    if (!project || !["PRO", "BUSINESS"].includes(project.owner.plan)) throw new CollaborationError("Google Chat requires a Pro or Business plan.", 402);
    const integration = await tx.integration.findFirst({ where: { id: input.integrationId, projectId: input.projectId, type: "GOOGLE_CHAT", enabled: true }, select: { id: true } });
    if (!integration) throw new CollaborationError("Connect and enable a Google Chat space in project integrations first.", 400);
    const feedback = await tx.feedback.findFirst({ where: { id: input.feedbackId, projectId: input.projectId } });
    if (!feedback) throw new CollaborationError("Task not found.", 404);
    const id = discussionJobId(integration.id, feedback.id);
    const payload: IntegrationPayload = { event: "ISSUE_SHARED", project: { id: input.projectId, name: project.name }, feedback: { id: feedback.id, title: feedback.title, content: feedback.content, type: feedback.type }, integrationId: integration.id };
    const job = await tx.notificationJob.upsert({ where: { id }, create: { id, type: "INTEGRATION", payload: payload as unknown as Prisma.InputJsonValue }, update: {} });
    if (job.status === "FAILED") {
      await tx.notificationJob.update({ where: { id }, data: { status: "PENDING", attempts: 0, availableAt: new Date(), lastError: null, lockedAt: null } });
    }
    return { status: job.status === "FAILED" ? "PENDING" : job.status };
  }, client);
}
