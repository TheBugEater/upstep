import type { PrismaClient } from "@prisma/client";
import { db } from "./db";
import { generateMcpKey, hashMcpKey, isMcpKey } from "./mcp-credentials";
import { getProjectAccess } from "./project-auth";
import { CollaborationError, collaborationTransaction } from "./project-collaboration";

export async function authenticateMcpKey(key: string, client: PrismaClient = db) {
  if (!isMcpKey(key)) return null;
  const keyHash = hashMcpKey(key);
  const credential = await client.mcpCredential.findUnique({
    where: { keyHash },
    select: { id: true, revokedAt: true, userId: true,
      project: { select: { id: true, name: true, moderationEnabled: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });
  if (credential) {
    if (credential.revokedAt) return null;
    // Membership and current role are checked on every request, never cached in a key.
    const access = await getProjectAccess(credential.project.id, credential.userId, client);
    if (!access) return null;
    return { ...credential.project, credentialId: credential.id, canManage: access.canManage,
      actor: { id: credential.user.id, name: credential.user.name?.trim() || credential.user.email, role: access.role, isOwner: access.isOwner },
    };
  }
  // Preserve existing integrations, without attributing a shared secret to a human.
  const project = await client.project.findUnique({ where: { mcpKeyHash: keyHash }, select: { id: true, name: true, moderationEnabled: true } });
  return project ? { ...project, credentialId: null, canManage: true, actor: null } : null;
}

export async function issuePersonalMcpKey(projectId: string, userId: string, client: PrismaClient = db) {
  return collaborationTransaction(async (tx) => {
    if (!await getProjectAccess(projectId, userId, tx)) throw new CollaborationError("Project not found.", 404);
    const mcpKey = generateMcpKey();
    await tx.mcpCredential.upsert({
      where: { projectId_userId: { projectId, userId } },
      create: { projectId, userId, keyHash: hashMcpKey(mcpKey) },
      update: { keyHash: hashMcpKey(mcpKey), revokedAt: null },
    });
    return { mcpKey };
  }, client);
}

export async function revokePersonalMcpKey(projectId: string, actorId: string, userId = actorId, client: PrismaClient = db) {
  return collaborationTransaction(async (tx) => {
    const access = await getProjectAccess(projectId, actorId, tx);
    if (!access) throw new CollaborationError("Project not found.", 404);
    if (userId !== actorId && !access.isOwner) throw new CollaborationError("Only the owner can revoke another teammate's MCP key.", 403);
    await tx.mcpCredential.updateMany({ where: { projectId, userId }, data: { keyHash: null, revokedAt: new Date() } });
    return { ok: true };
  }, client);
}

export async function revokeLegacyMcpKey(projectId: string, actorId: string, client: PrismaClient = db) {
  return collaborationTransaction(async (tx) => {
    if (!(await getProjectAccess(projectId, actorId, tx))?.isOwner) throw new CollaborationError("Only the owner can revoke the legacy shared MCP key.", 403);
    await tx.project.update({ where: { id: projectId }, data: { mcpKeyHash: null } });
    return { ok: true };
  }, client);
}

export async function personalMcpSummary(projectId: string, userId: string, client: PrismaClient = db) {
  const access = await getProjectAccess(projectId, userId, client);
  if (!access) throw new CollaborationError("Project not found.", 404);
  const [own, legacy, keys] = await Promise.all([
    client.mcpCredential.findUnique({ where: { projectId_userId: { projectId, userId } }, select: { keyHash: true, revokedAt: true } }),
    client.project.findUniqueOrThrow({ where: { id: projectId }, select: { mcpKeyHash: true } }),
    access.isOwner ? client.mcpCredential.findMany({
      where: { projectId, keyHash: { not: null }, revokedAt: null },
      select: { userId: true, updatedAt: true, user: { select: { name: true, email: true } } }, orderBy: { createdAt: "asc" },
    }) : [],
  ]);
  return { configured: !!own?.keyHash && !own.revokedAt, legacyConfigured: !!legacy.mcpKeyHash,
    keys: keys.map((key) => ({ userId: key.userId, name: key.user.name?.trim() || key.user.email, updatedAt: key.updatedAt })),
  };
}
