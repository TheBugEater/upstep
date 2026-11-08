import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { processSupportJobs } from "@/lib/support/worker";
import { processNotificationJobs } from "@/lib/notification-queue";

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });

  const supplied = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const valid = supplied.length === secret.length && timingSafeEqual(Buffer.from(supplied), Buffer.from(secret));
  if (!valid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const notifications = await processNotificationJobs(50);
  const support = await processSupportJobs(25_000);
  return NextResponse.json({ ...notifications, support });
}
