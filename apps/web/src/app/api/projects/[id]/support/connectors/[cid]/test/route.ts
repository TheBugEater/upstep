import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { supportResponseError, teamRequest } from "@/lib/support/http";
import { SupportError } from "@/lib/support/policy";
import {
  connectorActions,
  runConnectorAction,
} from "@/lib/support/connectors";

type Context = { params: Promise<{ id: string; cid: string }> };
const schema = z.object({
  actionId: z.string().min(1).max(40),
  customerId: z.string().max(40).nullable().optional(),
  inputs: z.record(z.string().max(32), z.string().max(120)).default({}),
});

// Runs one saved action exactly as the AI would, as a chosen signed-in
// customer, and returns what the AI would see (sensitive fields removed).
export async function POST(req: NextRequest, { params }: Context) {
  try {
    const { id, cid } = await params;
    const { userId } = await teamRequest(req, id, true);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new SupportError("Choose an action to test.");
    const limit = await checkRateLimit({
      scope: "support-connector-test",
      identifier: `${id}:${userId}`,
      limit: 30,
      windowMs: 60_000,
    });
    if (!limit.allowed)
      throw new SupportError("Too many test calls. Try again in a minute.", 429);
    const connector = await db.supportConnector.findFirst({
      where: { id: cid, projectId: id },
    });
    if (!connector) throw new SupportError("Connector not found.", 404);
    const action = connectorActions(connector.actions).find(
      (a) => a.id === parsed.data.actionId,
    );
    if (!action) throw new SupportError("Save the action before testing it.", 404);
    const customer = parsed.data.customerId
      ? await db.supportCustomer.findFirst({
          where: { id: parsed.data.customerId, projectId: id },
          select: { externalId: true, email: true, verified: true },
        })
      : null;
    if (parsed.data.customerId && !customer)
      throw new SupportError("Customer not found.", 404);
    const result = await runConnectorAction(
      connector,
      action,
      customer || { externalId: null, email: null, verified: false },
      parsed.data.inputs,
    );
    return NextResponse.json(
      { result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return supportResponseError(e);
  }
}
