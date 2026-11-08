import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sdkRequest, supportResponseError } from "@/lib/support/http";
import { startConversation } from "@/lib/support/service";
import { supportCors } from "@/lib/support/policy";
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: supportCors });
}
export async function GET(req: NextRequest) {
  try {
    const { project, session } = await sdkRequest(req, true);
    const conversations = await db.supportConversation.findMany({
      where: { projectId: project.id, customerId: session!.customerId },
      select: { id: true, state: true, ticketId: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 30,
    });
    return NextResponse.json({ conversations }, { headers: supportCors });
  } catch (e) {
    return supportResponseError(e, true);
  }
}
export async function POST(req: NextRequest) {
  try {
    const { project, session } = await sdkRequest(req, true, true);
    const c = await startConversation(project.id, session!.customerId);
    return NextResponse.json(
      { id: c.id, state: c.state },
      { headers: supportCors },
    );
  } catch (e) {
    return supportResponseError(e, true);
  }
}
