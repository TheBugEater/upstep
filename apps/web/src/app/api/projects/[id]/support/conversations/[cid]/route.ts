import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { teamRequest, supportResponseError } from "@/lib/support/http";
import { SupportError } from "@/lib/support/policy";
import {
  createSupportTicket,
  teamConversationAction,
} from "@/lib/support/service";
import { processSupportJobs } from "@/lib/support/worker";
type Context = { params: Promise<{ id: string; cid: string }> };
export async function GET(req: NextRequest, { params }: Context) {
  try {
    const { id, cid } = await params;
    await teamRequest(req, id);
    const c = await db.supportConversation.findFirst({
      where: { id: cid, projectId: id },
      include: {
        customer: true,
        messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 500 },
      },
    });
    if (!c) throw new SupportError("Conversation not found.", 404);
    return NextResponse.json(c, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return supportResponseError(e);
  }
}
const schema = z.object({
  action: z.enum([
    "reply",
    "note",
    "takeover",
    "assign",
    "resolve",
    "ai",
    "ticket",
  ]),
  content: z.string().trim().min(1).max(4000).optional(),
  clientMessageId: z.string().uuid().optional(),
  assigneeId: z.string().nullable().optional(),
});
export async function POST(req: NextRequest, { params }: Context) {
  try {
    const { id, cid } = await params;
    const { userId } = await teamRequest(req, id);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new SupportError("Invalid conversation action.");
    if (parsed.data.action === "ticket")
      return NextResponse.json(await createSupportTicket(id, cid));
    await teamConversationAction({
      projectId: id,
      conversationId: cid,
      actorId: userId,
      ...parsed.data,
      action: parsed.data.action,
    });
    after(() => processSupportJobs().then(() => {}));
    return NextResponse.json({ saved: true });
  } catch (e) {
    return supportResponseError(e);
  }
}
