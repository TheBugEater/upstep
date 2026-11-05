import type { PrismaClient } from "@prisma/client";
import { db } from "./db";
import { getProjectAccess } from "./project-auth";
import { collaborationTransaction, CollaborationError } from "./project-collaboration";
import { queueIntegration } from "./notification-queue";

export async function addTaskComment(input: { projectId: string; feedbackId: string; actorId: string; content: string; parentId?: string }, client: PrismaClient = db) {
  const content = input.content.trim();
  if (!content || content.length > 2000) throw new CollaborationError("Comments must contain 1–2000 characters.", 400);
  return collaborationTransaction(async (tx) => {
    const access = await getProjectAccess(input.projectId, input.actorId, tx);
    if (!access) throw new CollaborationError("Task not found.", 404);
    const feedback = await tx.feedback.findFirst({ where: { id: input.feedbackId, projectId: input.projectId }, include: { project: { select: { name: true } } } });
    if (!feedback) throw new CollaborationError("Task not found.", 404);
    if (input.parentId && !await tx.comment.findFirst({ where: { id: input.parentId, feedbackId: input.feedbackId }, select: { id: true } })) {
      throw new CollaborationError("Reply must reference a comment on this task.", 400);
    }
    const author = await tx.user.findUniqueOrThrow({ where: { id: input.actorId }, select: { name: true, email: true } });
    const comment = await tx.comment.create({
      data: { feedbackId: input.feedbackId, content, authorId: input.actorId, authorName: author.name?.trim() || author.email, parentId: input.parentId ?? null, isOwner: access.isOwner },
      include: { author: { select: { id: true, name: true, image: true } } },
    });
    await queueIntegration({ event: "NEW_COMMENT", project: { id: input.projectId, name: feedback.project.name }, feedback: { id: feedback.id, title: feedback.title, content: feedback.content, type: feedback.type }, comment: { content, authorName: comment.authorName } }, tx);
    return comment;
  }, client);
}
