import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { supportResponseError, teamRequest } from "@/lib/support/http";
import { SupportError } from "@/lib/support/policy";
import {
  connectorData,
  connectorView,
  parseConnectorInput,
} from "@/lib/support/connectors";

type Context = { params: Promise<{ id: string; cid: string }> };

export async function PUT(req: NextRequest, { params }: Context) {
  try {
    const { id, cid } = await params;
    await teamRequest(req, id, true);
    const input = parseConnectorInput(await req.json().catch(() => null));
    const existing = await db.supportConnector.findFirst({
      where: { id: cid, projectId: id },
    });
    if (!existing) throw new SupportError("Connector not found.", 404);
    const updated = await db.supportConnector.update({
      where: { id: existing.id },
      data: connectorData(id, input, existing),
    });
    return NextResponse.json(
      { connector: connectorView(updated) },
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
