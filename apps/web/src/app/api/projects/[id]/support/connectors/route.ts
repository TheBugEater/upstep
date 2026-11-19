import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { supportResponseError, teamRequest } from "@/lib/support/http";
import { SupportError } from "@/lib/support/policy";
import {
  CONNECTOR_LIMITS,
  connectorData,
  connectorView,
  parseConnectorInput,
} from "@/lib/support/connectors";

type Context = { params: Promise<{ id: string }> };
const noStore = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    await teamRequest(req, id, true);
    const [connectors, customers] = await Promise.all([
      db.supportConnector.findMany({
        where: { projectId: id },
        orderBy: { createdAt: "asc" },
      }),
      // Signed-in customers a manager can test customer lookups as.
      db.supportCustomer.findMany({
        where: { projectId: id, verified: true, externalId: { not: null } },
        select: { id: true, name: true, email: true },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
    ]);
    return NextResponse.json(
      {
        connectors: connectors.map(connectorView),
        customers,
        limits: CONNECTOR_LIMITS,
      },
      { headers: noStore },
    );
  } catch (e) {
    return supportResponseError(e);
  }
}

export async function POST(req: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    await teamRequest(req, id, true);
    const input = parseConnectorInput(await req.json().catch(() => null));
    const count = await db.supportConnector.count({ where: { projectId: id } });
    if (count >= CONNECTOR_LIMITS.connectors)
      throw new SupportError(
        `A project can have up to ${CONNECTOR_LIMITS.connectors} connectors.`,
      );
    const created = await db.supportConnector.create({
      data: { projectId: id, ...connectorData(id, input) },
    });
    return NextResponse.json(
      { connector: connectorView(created) },
      { status: 201, headers: noStore },
    );
  } catch (e) {
    return supportResponseError(e);
  }
}
