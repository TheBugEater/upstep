import { Prisma, type PrismaClient } from "@prisma/client";
import { db } from "./db";
import { getProjectAccess } from "./project-auth";

export class CollaborationError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

// Membership removal and assignment must serialize so a concurrent assignment
// cannot leave a task assigned to a teammate who no longer has project access.
export async function collaborationTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>, client: PrismaClient = db): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await client.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
    catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 5) {
        // Give concurrent writers time to commit before trying the same transaction again.
        await new Promise(resolve => setTimeout(resolve, Math.min(200, 10 * 2 ** attempt) + Math.floor(Math.random() * 10)));
        continue;
      }
      throw error;
    }
  }
}

export async function changeMemberRole(input: { projectId: string; actorId: string; userId: string; role: "ADMIN" | "MEMBER" }, client: PrismaClient = db) {
  return collaborationTransaction(async (tx) => {
    const access = await getProjectAccess(input.projectId, input.actorId, tx);
    if (!access?.isOwner) throw new CollaborationError("Only the owner can change team roles.", 403);
    const updated = await tx.projectMember.updateMany({
      where: { projectId: input.projectId, userId: input.userId, role: { not: "OWNER" }, project: { ownerId: { not: input.userId } } },
      data: { role: input.role },
    });
    if (!updated.count) throw new CollaborationError("Member not found.", 404);
    return { userId: input.userId, role: input.role };
  }, client);
}

export async function removeProjectMember(input: { projectId: string; actorId: string; userId: string }, client: PrismaClient = db) {
  return collaborationTransaction(async (tx) => {
    const access = await getProjectAccess(input.projectId, input.actorId, tx);
    if (!access?.canManage) throw new CollaborationError("Forbidden", 403);
    const member = await tx.projectMember.findFirst({
      where: { projectId: input.projectId, userId: input.userId, role: { not: "OWNER" }, project: { ownerId: { not: input.userId } } },
    });
    if (!member) throw new CollaborationError("Member not found.", 404);
    if (!access.isOwner && member.role !== "MEMBER") throw new CollaborationError("Only the owner can remove an admin.", 403);
    await tx.feedback.updateMany({ where: { projectId: input.projectId, assigneeId: input.userId }, data: { assigneeId: null } });
    await tx.supportPresence.updateMany({ where: { projectId: input.projectId, userId: input.userId }, data: { available: false } });
    await tx.supportConversation.updateMany({ where: { projectId: input.projectId, assignedToId: input.userId }, data: { assignedToId: null, state: "WAITING", revision: { increment: 1 }, aiPending: false, aiLock: null, aiLockedAt: null } });
    await tx.mcpCredential.updateMany({ where: { projectId: input.projectId, userId: input.userId }, data: { keyHash: null, revokedAt: new Date() } });
    await tx.projectMember.delete({ where: { id: member.id } });
    return { ok: true };
  }, client);
}
