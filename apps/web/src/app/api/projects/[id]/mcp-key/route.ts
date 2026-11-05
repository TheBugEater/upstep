import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { issuePersonalMcpKey, personalMcpSummary, revokeLegacyMcpKey, revokePersonalMcpKey } from "@/lib/mcp-access";
import { CollaborationError } from "@/lib/project-collaboration";

type RouteContext = { params: Promise<{ id: string }> };
const privateHeaders = { "Cache-Control": "no-store" };

async function handle(req: NextRequest, context: RouteContext, method: "GET" | "POST" | "DELETE") {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: privateHeaders });
  const { id } = await context.params;
  try {
    if (method === "GET") return NextResponse.json(await personalMcpSummary(id, session.user.id), { headers: privateHeaders });
    if (method === "POST") return NextResponse.json(await issuePersonalMcpKey(id, session.user.id), { headers: privateHeaders });
    const result = req.nextUrl.searchParams.get("legacy") === "1"
      ? await revokeLegacyMcpKey(id, session.user.id)
      : await revokePersonalMcpKey(id, session.user.id, req.nextUrl.searchParams.get("userId") ?? session.user.id);
    return NextResponse.json(result, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof CollaborationError) return NextResponse.json({ error: error.message }, { status: error.status, headers: privateHeaders });
    throw error;
  }
}

export function GET(req: NextRequest, context: RouteContext) { return handle(req, context, "GET"); }
export function POST(req: NextRequest, context: RouteContext) { return handle(req, context, "POST"); }
export function DELETE(req: NextRequest, context: RouteContext) { return handle(req, context, "DELETE"); }
