import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { mobileRequest } from "@/lib/mobile/auth";
import { markConversationRead } from "@/lib/mobile/inbox";
import { SupportError } from "@/lib/support/policy";
import { supportResponseError } from "@/lib/support/http";
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; cid: string }> },
) {
  try {
    const { id, cid } = await params;
    const { userId } = await mobileRequest(req);
    const input = z
      .object({ messageId: z.string().min(1).max(128) })
      .safeParse(await req.json().catch(() => null));
    if (!input.success) throw new SupportError("Message is required.");
    await markConversationRead(id, cid, userId, input.data.messageId);
    return NextResponse.json({ saved: true });
  } catch (e) {
    return supportResponseError(e);
  }
}
