import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { supportResponseError, teamRequest } from "@/lib/support/http";
import { CONNECTOR_LIMITS, parseConnectorInput } from "@/lib/support/connectors";
import { listSupportConnectors, saveSupportConnector } from "@/lib/support/connector-management";

type Context = { params: Promise<{ id: string }> };
const noStore = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    await teamRequest(req, id, true);
    const [connectors, customers] = await Promise.all([
      listSupportConnectors(id),
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
        connectors,
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
    const { connector } = await saveSupportConnector(id, input);
    return NextResponse.json(
      { connector },
      { status: 201, headers: noStore },
    );
  } catch (e) {
    return supportResponseError(e);
  }
}
