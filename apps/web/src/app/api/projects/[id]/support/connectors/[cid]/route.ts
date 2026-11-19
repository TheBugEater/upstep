import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { supportResponseError, teamRequest } from "@/lib/support/http";
import { SupportError } from "@/lib/support/policy";
import { parseConnectorInput } from "@/lib/support/connectors";
import { saveSupportConnector } from "@/lib/support/connector-management";

type Context = { params: Promise<{ id: string; cid: string }> };

export async function PUT(req: NextRequest, { params }: Context) {
  try {
    const { id, cid } = await params;
    await teamRequest(req, id, true);
    const input = parseConnectorInput(await req.json().catch(() => null));
    const { connector } = await saveSupportConnector(id, input, { id: cid });
    return NextResponse.json(
      { connector },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return supportResponseError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Context) {
  try {
    const { id, cid } = await params;
    await teamRequest(req, id, true);
    const removed = await db.supportConnector.deleteMany({
      where: { id: cid, projectId: id },
    });
    if (!removed.count) throw new SupportError("Connector not found.", 404);
    return NextResponse.json({ deleted: true });
  } catch (e) {
    return supportResponseError(e);
  }
}
