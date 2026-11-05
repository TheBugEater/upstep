import { createHash, randomBytes } from "node:crypto";

export const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
export const INVITATION_RESEND_DELAY_MS = 60 * 1000;

export function generateInvitationToken() {
  return randomBytes(32).toString("base64url");
}

export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isInvitationToken(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function invitationCookieName(id: string) {
  return `upstep-invitation-${id}`;
}
