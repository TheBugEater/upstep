import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "./db";

type RateLimitOptions = {
  scope: string;
  identifier: string;
  limit: number;
  windowMs: number;
};

export async function checkRateLimit({ scope, identifier, limit, windowMs }: RateLimitOptions) {
  const now = Date.now();
  const window = Math.floor(now / windowMs);
  const key = `${scope}:${identifier}:${window}`;
  const expiresAt = new Date((window + 1) * windowMs);
  const bucket = await db.rateLimitBucket.upsert({
    where: { key },
    create: { key, count: 1, expiresAt },
    update: { count: { increment: 1 } },
    select: { count: true },
  });

  return {
    allowed: bucket.count <= limit,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    retryAfter: Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000)),
  };
}

export function requestIdentifier(req: NextRequest) {
  const raw =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  return createHash("sha256").update(raw).digest("hex").slice(0, 24);
}

export function rateLimitResponse(result: Awaited<ReturnType<typeof checkRateLimit>>, headers?: HeadersInit) {
  return NextResponse.json(
    { error: "Too many requests. Please slow down." },
    {
      status: 429,
      headers: {
        ...headers,
        "Retry-After": String(result.retryAfter),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
      },
    }
  );
}

export async function enforceProjectAndClientLimits(
  req: NextRequest,
  projectId: string,
  scope: string,
  limits: { project: number; client: number; windowMs?: number }
) {
  const windowMs = limits.windowMs ?? 60_000;
  const [project, client] = await Promise.all([
    checkRateLimit({ scope, identifier: `project:${projectId}`, limit: limits.project, windowMs }),
    checkRateLimit({
      scope,
      identifier: `client:${projectId}:${requestIdentifier(req)}`,
      limit: limits.client,
      windowMs,
    }),
  ]);
  return !project.allowed ? project : !client.allowed ? client : null;
}
