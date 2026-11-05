import type { Prisma } from "@prisma/client";
import { CollaborationError } from "./project-collaboration";

export async function isProjectAssignee(projectId: string, userId: string, client: Pick<Prisma.TransactionClient, "project">): Promise<boolean> {
  return !!await client.project.findFirst({
    where: { id: projectId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    select: { id: true },
  });
}

export async function assertProjectAssignee(projectId: string, userId: string | null | undefined, client: Pick<Prisma.TransactionClient, "project">) {
  if (userId && !await isProjectAssignee(projectId, userId, client)) {
    throw new CollaborationError("Assign tasks to a current project teammate.", 400);
  }
}
