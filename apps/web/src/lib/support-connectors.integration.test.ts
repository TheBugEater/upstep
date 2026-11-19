import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { processAIConversation } from "./support/worker";
import { connectorData, type ConnectorFetcher } from "./support/connectors";
import { publicMessage } from "./support/http";
import type { SupportAIProvider } from "./support/ai";

process.env.SUPPORT_CONNECTOR_SECRET ||= "integration-connector-secret";
const url = process.env.UPSTEP_INVITATION_TEST_DATABASE_URL;

test(
  "support connectors: verified customers get scoped read-only lookups; guests and customers never see the trace",
  { skip: !url },
  async () => {
    const db = new PrismaClient({ datasourceUrl: url! });
    const suffix = randomUUID();
    const owner = await db.user.create({
      data: { email: `connectors-${suffix}@example.test`, plan: "PRO" },
    });
    const project = await db.project.create({
      data: {
        name: "Northwind",
        slug: `connectors-${suffix}`,
        ownerId: owner.id,
        supportConfig: {
          create: {
            enabled: true,
            domain: "example.com",
            businessName: "Northwind",
            supportEmail: "help@example.com",
            crawlState: "READY",
          },
        },
      },
    });
    try {
      await db.supportConnector.create({
        data: {
          projectId: project.id,
          ...connectorData(project.id, {
            name: "Roastery API",
            baseUrl: "https://api.example.com/v1",
            authType: "BEARER",
            secret: "sk_test_roastery_123",
            enabled: true,
            actions: [
              {
                id: "a1",
                name: "get_schedule",
                description: "Use when the customer asks when their next delivery ships.",
                path: "/customers/{customer_id}/schedule",
                scope: "CUSTOMER",
                enabled: true,
                inputs: [],
                hiddenFields: ["phone"],
              },
            ],
          }),
        },
      });
      const requests: { url: string; auth: string | undefined }[] = [];
      const fetcher: ConnectorFetcher = async (u, headers) => {
        requests.push({ url: u.href, auth: headers.Authorization });
        return { status: 200, data: { next_ship_date: "2026-12-03", phone: "555-0100" } };
      };
      let planned = 0;
      const provider: SupportAIProvider = {
        async checkScope() {
          return true;
        },
        async planLookups(_input, tools) {
          planned++;
          assert.deepEqual(tools.map((t) => t.action), ["get_schedule"]);
          return { calls: [{ tool: tools[0]!.key, inputs: [] }] };
        },
        async reply(input) {
          const lookups = input.lookups || [];
          return {
            inScope: true,
            resolution: "answer",
            escalationReason: "none",
            reply: lookups.length
              ? `Your next bag ships ${JSON.parse(lookups[0]!.data!).next_ship_date}.`
              : "I can't check that without you signing in.",
            sources: [],
            offerTicket: false,
            handoff: false,
            ticketTitle: "",
            ticketType: "GENERAL",
            ...(lookups.length
              ? { issueSummary: lookups[0]!.data!.includes("555") ? "LEAK" : "ok" }
              : {}),
          };
        },
      };
      const conversation = async (customer: {
        externalId?: string;
        email?: string;
        verified: boolean;
      }) => {
        const c = await db.supportCustomer.create({
          data: { projectId: project.id, ...customer },
        });
        return db.supportConversation.create({
          data: {
            projectId: project.id,
            customerId: c.id,
            state: "AI",
            aiPending: true,
            messages: {
              create: {
                clientMessageId: randomUUID(),
                role: "CUSTOMER",
                authorName: "Customer",
                content: "When does my next delivery ship?",
              },
            },
          },
        });
      };

      const verified = await conversation({
        externalId: "cus_8213",
        email: "priya@example.com",
        verified: true,
      });
      assert.equal(await processAIConversation(db, provider, project.id, fetcher), true);
      const reply = await db.supportMessage.findFirstOrThrow({
        where: { conversationId: verified.id, role: "ASSISTANT" },
      });
      assert.match(reply.content, /2026-12-03/);
      assert.deepEqual(requests, [
        {
          url: "https://api.example.com/v1/customers/cus_8213/schedule",
          auth: "Bearer sk_test_roastery_123",
        },
      ]);
      const meta = reply.metadata as Record<string, any>;
      assert.equal(meta.issueSummary, "ok", "hidden fields must not reach the model");
      assert.deepEqual(
        meta.lookups.map((l: any) => [l.connector, l.action, l.ok, l.status]),
        [["Roastery API", "get_schedule", true, 200]],
      );
      assert.equal("lookups" in (publicMessage(reply).metadata as object), false);

      // A guest never gets customer tools, so no planning call or request happens.
      const guest = await conversation({ verified: false });
      assert.equal(await processAIConversation(db, provider, project.id, fetcher), true);
      const guestReply = await db.supportMessage.findFirstOrThrow({
        where: { conversationId: guest.id, role: "ASSISTANT" },
      });
      assert.match(guestReply.content, /signing in/);
      assert.equal(planned, 1);
      assert.equal(requests.length, 1);
      assert.equal("lookups" in (guestReply.metadata as object), false);

      // A failing planner never blocks the reply.
      const again = await conversation({ externalId: "cus_9", verified: true });
      await processAIConversation(
        db,
        { ...provider, planLookups: async () => { throw new Error("provider down"); } },
        project.id,
        fetcher,
      );
      assert.ok(
        await db.supportMessage.findFirst({ where: { conversationId: again.id, role: "ASSISTANT" } }),
      );
    } finally {
      await db.project.delete({ where: { id: project.id } });
      await db.supportUsage.deleteMany({ where: { ownerId: owner.id } });
      await db.user.delete({ where: { id: owner.id } });
      await db.$disconnect();
    }
  },
);
