import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "../db";
import { SupportError } from "../support/policy";

export const MOBILE_CALLBACK = "upstep://auth";
export const ACCESS_MS = 15 * 60_000;
const SESSION_MS = 30 * 24 * 60 * 60_000;
export const secret = () => randomBytes(32).toString("base64url");
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const pkceChallenge = (verifier: string) =>
  createHash("sha256").update(verifier).digest("base64url");
export const validChallenge = (value: string) =>
  /^[A-Za-z0-9_-]{43}$/.test(value);

export async function createLoginCode(
  userId: string,
  challenge: string,
  client = db,
) {
  if (!validChallenge(challenge))
    throw new SupportError("Invalid sign-in request.");
  const code = secret();
  await client.mobileLoginCode.create({
    data: {
      userId,
      challenge,
      codeHash: digest(code),
      expiresAt: new Date(Date.now() + 120_000),
    },
  });
  return code;
}

function credentials() {
  return {
    accessToken: secret(),
    refreshToken: secret(),
    accessExpiresAt: new Date(Date.now() + ACCESS_MS),
  };
}
export async function exchangeLoginCode(
  code: string,
  verifier: string,
  client: PrismaClient = db,
) {
  if (!validChallenge(code) || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier))
    throw new SupportError("Invalid sign-in code.", 401);
  const tokens = credentials();
  await client.$transaction(async (tx) => {
    const login = await tx.mobileLoginCode.findUnique({
      where: { codeHash: digest(code) },
    });
    const challenge = pkceChallenge(verifier);
    if (
      !login ||
      login.expiresAt.getTime() <= Date.now() ||
      login.challenge.length !== challenge.length ||
      !timingSafeEqual(Buffer.from(login.challenge), Buffer.from(challenge))
    )
      throw new SupportError("Sign-in expired. Please sign in again.", 401);
    const used = await tx.mobileLoginCode.deleteMany({
      where: { id: login.id, expiresAt: { gt: new Date() } },
    });
    if (!used.count)
      throw new SupportError("Sign-in code was already used.", 401);
    await tx.mobileSession.create({
      data: {
        userId: login.userId,
        accessHash: digest(tokens.accessToken),
        refreshHash: digest(tokens.refreshToken),
        accessExpiresAt: tokens.accessExpiresAt,
        expiresAt: new Date(Date.now() + SESSION_MS),
      },
    });
  });
  return tokens;
}

export async function refreshMobileSession(
  refreshToken: string,
  client: PrismaClient = db,
) {
  if (!validChallenge(refreshToken))
    throw new SupportError("Please sign in again.", 401);
  const tokens = credentials();
  const updated = await client.mobileSession.updateMany({
    where: {
      refreshHash: digest(refreshToken),
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: {
      accessHash: digest(tokens.accessToken),
      refreshHash: digest(tokens.refreshToken),
      accessExpiresAt: tokens.accessExpiresAt,
    },
  });
  if (!updated.count)
    throw new SupportError("Session expired. Please sign in again.", 401);
  return tokens;
}

export async function mobileRequest(
  req: Pick<Request, "headers">,
  client: Pick<Prisma.TransactionClient, "mobileSession"> = db,
) {
  const token = req.headers
    .get("authorization")
    ?.match(/^Bearer ([A-Za-z0-9_-]{43})$/i)?.[1];
  if (!token) throw new SupportError("Unauthorized", 401);
  const session = await client.mobileSession.findUnique({
    where: { accessHash: digest(token) },
  });
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt.getTime() <= Date.now() ||
    session.accessExpiresAt.getTime() <= Date.now()
  )
    throw new SupportError("Session expired. Please sign in again.", 401);
  return { userId: session.userId, sessionId: session.id };
}

export async function revokeMobileSession(
  sessionId: string,
  client: PrismaClient = db,
) {
  await client.$transaction(async (tx) => {
    await tx.mobileSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
    await tx.mobileDevice.deleteMany({ where: { sessionId } });
  });
}
