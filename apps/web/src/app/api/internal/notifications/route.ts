import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { processSupportJobs } from "@/lib/support/worker";
import { processNotificationJobs } from "@/lib/notification-queue";
import { processPushReceipts } from "@/lib/mobile/push";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret)
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 },
    );

  const supplied =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const valid =
    supplied.length === secret.length &&
    timingSafeEqual(Buffer.from(supplied), Buffer.from(secret));
  if (!valid)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const notifications = await processNotificationJobs(50);
  const support = await processSupportJobs(25_000);
  const receipts = await processPushReceipts().catch(() => 0);
  await Promise.all([
    db.mobileLoginCode.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    db.mobileSession.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { revokedAt: { lt: new Date(Date.now() - 24 * 60 * 60_000) } },
        ],
      },
    }),
    db.supportPushDelivery.deleteMany({
      where: {
        createdAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60_000) },
      },
    }),
  ]);
  return NextResponse.json({ ...notifications, support, receipts });
}
