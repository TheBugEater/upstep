import { NextRequest } from "next/server";
import { db } from "./db";

export async function getProjectFromRequest(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return null;

  return db.project.findUnique({
    where: { apiKey },
    include: { owner: { select: { plan: true, email: true } } },
  });
}

/** Derives a stable anonymous fingerprint from the request — not used for hard deduplication */
export function getFingerprint(req: NextRequest): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ua = req.headers.get("user-agent") ?? "unknown";
  // Simple hash — good enough for soft rate-limiting, not a security boundary
  let hash = 0;
  for (const char of `${ip}:${ua}`) {
    hash = (hash << 5) - hash + char.charCodeAt(0);
    hash |= 0;
  }
  return hash.toString(36);
}
