import type { Prisma, ProjectInvitation } from "@prisma/client";
import { queueEmail } from "./notification-queue";
import {
  generateInvitationToken, hashInvitationToken, isInvitationToken,
  INVITATION_LIFETIME_MS, INVITATION_RESEND_DELAY_MS,
} from "./invitation-tokens";

type InvitationClient = Pick<Prisma.TransactionClient, "projectInvitation" | "projectMember" | "user" | "notificationJob">;
type AcceptClient = Pick<Prisma.TransactionClient, "projectInvitation" | "projectMember">;

export class InvitationError extends Error {
  constructor(public code: "invalid" | "expired" | "wrong-account" | "resend-too-soon") {
    super(code);
  }
}

// Never expose the token digest or acceptance metadata to the dashboard client.
export function invitationSummary(invitation: ProjectInvitation) {
  return {
    id: invitation.id, email: invitation.email, expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt, lastSentAt: invitation.lastSentAt,
  };
}

/** Call in a transaction: the pending invitation and its email job commit together. */
export async function createProjectInvitation(input: {
  projectId: string; projectName: string; inviterName: string | null;
  email: string; resend?: boolean;
}, client: InvitationClient, now = new Date()) {
  const email = input.email.trim().toLowerCase();
  const alreadyMember = await client.projectMember.findFirst({
    where: { projectId: input.projectId, user: { email: { equals: email, mode: "insensitive" } } },
    select: { id: true },
  });
  if (alreadyMember) return { alreadyMember: true, emailQueued: false, invitation: null };

  const token = generateInvitationToken();
  const tokenHash = hashInvitationToken(token);
  const expiresAt = new Date(now.getTime() + INVITATION_LIFETIME_MS);
  const inserted = await client.projectInvitation.createMany({
    data: { projectId: input.projectId, email, tokenHash, expiresAt, lastSentAt: now },
    skipDuplicates: true,
  });
  const where = { projectId_email: { projectId: input.projectId, email } };
  let invitation = await client.projectInvitation.findUniqueOrThrow({ where });
  if (!inserted.count) {
    const pending = !invitation.acceptedAt && !invitation.revokedAt && invitation.expiresAt > now;
    if (pending && !input.resend) {
      return { alreadyMember: false, emailQueued: false, invitation: invitationSummary(invitation) };
    }
    if (input.resend && invitation.lastSentAt.getTime() + INVITATION_RESEND_DELAY_MS > now.getTime()) {
      throw new InvitationError("resend-too-soon");
    }
    const updated = await client.projectInvitation.updateMany({
      // Comparing the old digest prevents concurrent resends from sending two links.
      where: { id: invitation.id, tokenHash: invitation.tokenHash, acceptedAt: invitation.acceptedAt, revokedAt: invitation.revokedAt },
      data: { tokenHash, expiresAt, lastSentAt: now, acceptedAt: null, acceptedById: null, revokedAt: null },
    });
    invitation = await client.projectInvitation.findUniqueOrThrow({ where });
    if (!updated.count) {
      if (invitation.acceptedAt) return { alreadyMember: true, emailQueued: false, invitation: null };
      return { alreadyMember: false, emailQueued: false, invitation: invitationSummary(invitation) };
    }
  }
  const recipient = await client.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } }, select: { name: true },
  });
  await queueEmail({
    kind: "PROJECT_INVITATION", invitationId: invitation.id, token,
    toEmail: email, recipientName: recipient?.name ?? null,
    inviterName: input.inviterName, projectId: input.projectId, projectName: input.projectName,
  }, client);
  return { alreadyMember: false, emailQueued: true, invitation: invitationSummary(invitation) };
}

/** Authenticated POST only. A GET/email scanner can never grant project access. */
export async function acceptProjectInvitation(input: {
  invitationId: string; token: string; userId: string; email: string;
}, client: AcceptClient, now = new Date()) {
  if (!isInvitationToken(input.token)) throw new InvitationError("invalid");
  const email = input.email.trim().toLowerCase();
  const invitation = await client.projectInvitation.findFirst({
    where: { id: input.invitationId, tokenHash: hashInvitationToken(input.token) },
  });
  if (!invitation || invitation.revokedAt) throw new InvitationError("invalid");
  if (invitation.email !== email) throw new InvitationError("wrong-account");
  if (invitation.acceptedAt) {
    const member = invitation.acceptedById === input.userId && await client.projectMember.findUnique({
      where: { projectId_userId: { projectId: invitation.projectId, userId: input.userId } },
    });
    if (!member) throw new InvitationError("invalid");
    return invitation.projectId;
  }
  if (invitation.expiresAt <= now) throw new InvitationError("expired");
  const claimed = await client.projectInvitation.updateMany({
    where: {
      id: invitation.id, tokenHash: invitation.tokenHash, email,
      acceptedAt: null, revokedAt: null, expiresAt: { gt: now },
    },
    data: { acceptedAt: now, acceptedById: input.userId },
  });
  if (!claimed.count) {
    // A concurrent second click is harmless; a revoke/resend must fail closed.
    const accepted = await client.projectInvitation.findFirst({
      where: { id: invitation.id, tokenHash: invitation.tokenHash, acceptedById: input.userId, acceptedAt: { not: null }, revokedAt: null },
    });
    if (!accepted) throw new InvitationError("invalid");
    const member = await client.projectMember.findUnique({
      where: { projectId_userId: { projectId: invitation.projectId, userId: input.userId } },
    });
    if (!member) throw new InvitationError("invalid");
    return invitation.projectId;
  }
  await client.projectMember.createMany({
    data: { projectId: invitation.projectId, userId: input.userId, role: "MEMBER" },
    skipDuplicates: true,
  });
  return invitation.projectId;
}
