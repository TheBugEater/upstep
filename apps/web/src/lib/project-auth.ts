import { db } from "./db";

export type ProjectAccess = {
  projectId: string;
  isOwner: boolean;
};

/**
 * Returns project access info if userId is the owner or an invited member,
 * null if the user has no access or the project doesn't exist.
 */
export async function getProjectAccess(
  projectId: string,
  userId: string
): Promise<ProjectAccess | null> {
  const project = await db.project.findUnique({
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

  return { projectId, isOwner };
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
