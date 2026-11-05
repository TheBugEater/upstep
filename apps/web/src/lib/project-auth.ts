import { db } from "./db";
import type { Prisma } from "@prisma/client";

export type ProjectAccess = {
  projectId: string;
  isOwner: boolean;
  canManage: boolean;
  role: "OWNER" | "ADMIN" | "MEMBER";
};

/**
 * Returns project access info if userId is the owner or an invited member,
 * null if the user has no access or the project doesn't exist.
 */
export async function getProjectAccess(
  projectId: string,
  userId: string,
  client: Pick<Prisma.TransactionClient, "project"> = db,
): Promise<ProjectAccess | null> {
  const project = await client.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      ownerId: true,
      members: { where: { userId }, select: { role: true } },
    },
  });
  if (!project) return null;

  const isOwner = project.ownerId === userId;
  const isMember = project.members.length > 0;
  if (!isOwner && !isMember) return null;

  const role = isOwner ? "OWNER" : project.members[0]?.role === "ADMIN" ? "ADMIN" : "MEMBER";
  return { projectId, isOwner, role, canManage: role === "OWNER" || role === "ADMIN" };
}

/** Project admins can manage setup and invitations, but not ownership or keys. */
export async function requireAdmin(projectId: string, userId: string): Promise<boolean> {
  return (await getProjectAccess(projectId, userId))?.canManage ?? false;
}

/** Shorthand for routes that require owner-level access. */
export async function requireOwner(
  projectId: string,
  userId: string
): Promise<boolean> {
  const project = await db.project.findFirst({
    where: { id: projectId, ownerId: userId },
    select: { id: true },
  });
  return !!project;
}
