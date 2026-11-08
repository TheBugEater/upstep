import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  sdkRequest,
  supportResponseError,
  customerConversation,
  publicMessageSelect,
} from "@/lib/support/http";
import {
  customerMessage,
  requestHuman,
  createSupportTicket,
  submitSupportContact,
  submitIssueDetails,
} from "@/lib/support/service";
import {
  supportInteraction,
  assertEscalationAllowed,
} from "@/lib/support/interactions";
import { SupportError, supportCors } from "@/lib/support/policy";
import { processSupportJobs } from "@/lib/support/worker";
type Context = { params: Promise<{ cid: string }> };
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: supportCors });
}
export async function GET(req: NextRequest, { params }: Context) {
  try {
    const { cid } = await params;
    const { project, session } = await sdkRequest(req, true);
    const c = await customerConversation(project.id, session!.customerId, cid);
    const interaction = await supportInteraction(
      project.id,
      session!.customerId,
      cid,
    );
    const messages = await db.supportMessage.findMany({
      where: { conversationId: cid, role: { not: "NOTE" } },
      select: publicMessageSelect,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 500,
    });
    return NextResponse.json(
      {
        id: c.id,
        state: c.state,
        ticketId: c.ticketId,
        ticketReference: c.ticketReference,
        supportEmail: project.supportConfig?.supportEmail || null,
        aiPending: c.aiPending,
        canEscalate: interaction.canEscalate,
        escalationSummary: interaction.escalationSummary,
        activeWidgetMessageId: interaction.activeWidgetMessageId,
        humanRequested: c.humanRequested,
        messages,
        customer: {
          name: session!.customer.name,
          email: session!.customer.email,
          verified: session!.customer.verified,
        },
      },
      { headers: supportCors },
    );
  } catch (e) {
    return supportResponseError(e, true);
  }
}
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("message"),
    content: z.string().trim().min(1).max(4000),
    clientMessageId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("handoff"),
    name: z.string().trim().min(1).max(100),
    email: z.string().trim().email().max(254),
  }),
  z.object({
    action: z.literal("details"),
    widgetId: z.string().max(120),
    summary: z.string().trim().min(1).max(160),
    details: z.string().trim().max(2000).optional(),
    reference: z.string().trim().max(100).optional(),
    clientMessageId: z.string().uuid(),
  }),
  z.object({ action: z.literal("human") }),
  z.object({ action: z.literal("ticket") }),
  z.object({
    action: z.literal("contact"),
    name: z.string().trim().max(100).optional(),
    email: z.union([z.string().email().max(254), z.literal("")]).optional(),
  }),
]);
export async function POST(req: NextRequest, { params }: Context) {
  try {
    const { cid } = await params;
    const { project, session } = await sdkRequest(req, true, true);
    await customerConversation(project.id, session!.customerId, cid);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success)
      throw new SupportError("Enter a valid message or email address.");
    const action = parsed.data;
    if (action.action === "message")
      await customerMessage({
        projectId: project.id,
        customerId: session!.customerId,
        conversationId: cid,
        content: action.content,
        clientMessageId: action.clientMessageId,
      });
    if (action.action === "human")
      await requestHuman(project.id, cid, session!.customerId);
    if (action.action === "handoff")
      await submitSupportContact({
        projectId: project.id,
        customerId: session!.customerId,
        conversationId: cid,
        name: action.name,
        email: action.email,
      });
    if (action.action === "details")
      await submitIssueDetails({
        projectId: project.id,
        customerId: session!.customerId,
        conversationId: cid,
        ...action,
      });
    if (action.action === "ticket") {
      await assertEscalationAllowed(project.id, session!.customerId, cid);
      return NextResponse.json(await createSupportTicket(project.id, cid), {
        headers: supportCors,
      });
    }
    if (action.action === "contact") {
      if (session!.customer.verified)
        throw new SupportError("Update your details in your account.");
      await db.supportCustomer.update({
        where: { id: session!.customerId },
        data: {
          ...(action.name !== undefined ? { name: action.name || null } : {}),
          ...(action.email !== undefined
            ? { email: action.email || null }
            : {}),
        },
      });
    }
    after(() => processSupportJobs().then(() => {}));
    return NextResponse.json({ saved: true }, { headers: supportCors });
  } catch (e) {
    return supportResponseError(e, true);
  }
}
