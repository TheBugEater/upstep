import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { teamRequest, supportResponseError } from "@/lib/support/http";
import { assistConversation } from "@/lib/support/assistance";
import { SupportError } from "@/lib/support/policy";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; cid: string }> },
) {
  try {
    const { id, cid } = await params;
    const { userId } = await teamRequest(req, id);
    const input = z
      .object({ intent: z.enum(["summary", "draft"]) })
      .safeParse(await req.json().catch(() => null));
    if (!input.success)
      throw new SupportError("Choose a summary or reply draft.");
    const limit = await checkRateLimit({
      scope: "support-assistance",
      identifier: `${userId}:${id}`,
      limit: 5,
      windowMs: 60_000,
    });
    if (!limit.allowed) return rateLimitResponse(limit);
    return NextResponse.json(
      await assistConversation(id, cid, userId, input.data.intent),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return supportResponseError(e);
  }
}
