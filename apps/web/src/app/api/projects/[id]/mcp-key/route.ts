import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateMcpKey, hashMcpKey } from "@/lib/mcp-credentials";
import { requireOwner } from "@/lib/project-auth";

type RouteContext = { params: Promise<{ id: string }> };

// Generates or rotates the project-scoped MCP secret. Only its digest is
// persisted, so this response is the only time the plaintext can be shown.
export async function POST(_req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await requireOwner(id, session.user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const mcpKey = generateMcpKey();
  await db.project.update({ where: { id }, data: { mcpKeyHash: hashMcpKey(mcpKey) } });
  return NextResponse.json({ mcpKey });
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await requireOwner(id, session.user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.project.update({ where: { id }, data: { mcpKeyHash: null } });
  return NextResponse.json({ ok: true });
}
