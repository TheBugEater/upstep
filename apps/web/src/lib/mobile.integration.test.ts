import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  createLoginCode,
  exchangeLoginCode,
  refreshMobileSession,
  mobileRequest,
  revokeMobileSession,
  pkceChallenge,
  digest,
  secret,
} from "./mobile/auth";
import {
  deliverSupportPush,
  processPushReceipts,
  type SupportPushEvent,
} from "./mobile/push";
import { mobileInbox, markConversationRead } from "./mobile/inbox";
import {
  customerMessage,
  requestHuman,
  teamConversationAction,
} from "./support/service";
import { assistConversation } from "./support/assistance";
import {
  processAIConversation,
  resumeOfflineConversations,
} from "./support/worker";
import type { SupportAIProvider } from "./support/ai";
import { getSiteUrl } from "./site-url";

const url = process.env.UPSTEP_INVITATION_TEST_DATABASE_URL;
test(
  "mobile support: native identity, handoff races, private assistance and push routing",
  { skip: !url },
  async (t) => {
    const databasePath = new URL(url!).pathname;
    assert.ok(
      databasePath.endsWith("_test") || databasePath === "/build",
      "Use a dedicated test database",
    );
    const db = new PrismaClient({ datasourceUrl: url! });
    const suffix = randomUUID();
    const owner = await db.user.create({
      data: {
        name: "Owner",
        email: `mobile-owner-${suffix}@example.test`,
        plan: "PRO",
      },
    });
    const member = await db.user.create({
      data: { name: "Member", email: `mobile-member-${suffix}@example.test` },
    });
    const outsider = await db.user.create({
      data: { name: "Outsider", email: `mobile-other-${suffix}@example.test` },
    });
    const p = await db.project.create({
      data: {
        name: "Mobile test",
        slug: `mobile-${suffix}`,
        ownerId: owner.id,
        members: { create: { userId: member.id } },
        supportConfig: {
          create: {
            enabled: true,
            domain: "example.com",
            businessName: "Mobile test",
            crawlState: "READY",
          },
        },
      },
    });
    const customer = await db.supportCustomer.create({
      data: { projectId: p.id },
    });
    const conversation = await db.supportConversation.create({
      data: { projectId: p.id, customerId: customer.id },
    });
    const nativeLogin = async (userId: string) => {
      const verifier = secret();
      const code = await createLoginCode(userId, pkceChallenge(verifier), db);
      const tokens = await exchangeLoginCode(code, verifier, db);
      const session = await mobileRequest(
        new Request("https://upstep.example", {
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
        }),
        db,
      );
      return { ...tokens, ...session };
    };
    try {
      await t.test(
        "PKCE codes are hashed, single-use and bound to the app verifier; refresh tokens rotate",
        async () => {
          const verifier = secret();
          const code = await createLoginCode(
            owner.id,
            pkceChallenge(verifier),
            db,
          );
          assert.equal(
            (
              await db.mobileLoginCode.findUniqueOrThrow({
                where: { codeHash: digest(code) },
              })
            ).codeHash,
            digest(code),
          );
          await assert.rejects(
            exchangeLoginCode(code, secret(), db),
            /expired/,
          );
          const exchanges = await Promise.allSettled([
            exchangeLoginCode(code, verifier, db),
            exchangeLoginCode(code, verifier, db),
          ]);
          assert.equal(
            exchanges.filter((e) => e.status === "fulfilled").length,
            1,
          );
          const result = exchanges.find((e) => e.status === "fulfilled")!;
          if (result.status !== "fulfilled")
            throw new Error("No native session");
          const old = result.value;
          const rotated = await refreshMobileSession(old.refreshToken, db);
          await assert.rejects(
            refreshMobileSession(old.refreshToken, db),
            /expired/,
          );
          await assert.rejects(
            mobileRequest(
              new Request("https://upstep.example", {
                headers: { Authorization: `Bearer ${old.accessToken}` },
              }),
              db,
            ),
            /expired/,
          );
          const session = await mobileRequest(
            new Request("https://upstep.example", {
              headers: { Authorization: `Bearer ${rotated.accessToken}` },
            }),
            db,
          );
          await revokeMobileSession(session.sessionId, db);
          await assert.rejects(
            refreshMobileSession(rotated.refreshToken, db),
            /expired/,
          );
        },
      );
      await t.test(
        "explicit requests need no contact details and never silently resume AI",
        async () => {
          await customerMessage(
            {
              projectId: p.id,
              customerId: customer.id,
              conversationId: conversation.id,
              clientMessageId: randomUUID(),
              content: "I want a person to help me install the widget",
            },
            db,
          );
          await requestHuman(p.id, conversation.id, customer.id, db);
          await requestHuman(p.id, conversation.id, customer.id, db);
          await db.supportConversation.update({
            where: { id: conversation.id },
            data: { updatedAt: new Date(Date.now() - 120_000) },
          });
          await resumeOfflineConversations(db);
          const c = await db.supportConversation.findUniqueOrThrow({
            where: { id: conversation.id },
          });
          assert.equal(c.state, "WAITING");
          assert.equal(c.humanRequested, true);
          assert.equal(c.aiPending, false);
          assert.equal(
            await db.notificationJob.count({
              where: {
                type: "PUSH",
                payload: { path: ["kind"], equals: "HUMAN_REQUEST" },
                AND: [
                  {
                    payload: {
                      path: ["conversationId"],
                      equals: conversation.id,
                    },
                  },
                ],
              },
            }),
            1,
          );
          assert.equal(
            (await mobileInbox(p.id, owner.id, "needs_human", undefined, db))
              .conversations[0]?.id,
            conversation.id,
          );
          await assert.rejects(
            mobileInbox(p.id, outsider.id, "needs_human", undefined, db),
            /not found/,
          );
        },
      );
      let winner = owner.id;
      await t.test(
        "two simultaneous takeovers produce one winner; retried replies stay idempotent",
        async () => {
          const claim = (actorId: string) =>
            teamConversationAction(
              {
                projectId: p.id,
                conversationId: conversation.id,
                actorId,
                action: "takeover",
              },
              db,
            );
          const results = await Promise.allSettled([
            claim(owner.id),
            claim(member.id),
          ]);
          assert.equal(
            results.filter((r) => r.status === "fulfilled").length,
            1,
          );
          winner = (
            await db.supportConversation.findUniqueOrThrow({
              where: { id: conversation.id },
            })
          ).assignedToId!;
          const input = {
            projectId: p.id,
            conversationId: conversation.id,
            actorId: winner,
            action: "reply" as const,
            content: "I can help you here.",
            clientMessageId: randomUUID(),
          };
          await Promise.all([
            teamConversationAction(input, db),
            teamConversationAction(input, db),
          ]);
          assert.equal(
            await db.supportMessage.count({
              where: { conversationId: conversation.id, role: "AGENT" },
            }),
            1,
          );
          await teamConversationAction({ ...input, action: "resolve" }, db);
          await teamConversationAction(input, db); // A lost acknowledgment remains recoverable after resolution.
          await teamConversationAction(
            { ...input, action: "assign", assigneeId: winner },
            db,
          );
        },
      );
      await t.test(
        "private summaries and drafts exclude notes and never become customer messages",
        async () => {
          await teamConversationAction(
            {
              projectId: p.id,
              conversationId: conversation.id,
              actorId: winner,
              action: "note",
              content: "SECRET PRIVATE NOTE",
              clientMessageId: randomUUID(),
            },
            db,
          );
          const before = await db.supportMessage.count({
            where: { conversationId: conversation.id },
          });
          const provider: SupportAIProvider = {
            reply: async () => {
              throw new Error("Unused");
            },
            assist: async (input) => {
              assert(!JSON.stringify(input).includes("SECRET PRIVATE NOTE"));
              return {
                text: "The customer needs installation help.",
                sources: [],
                messageIds: input.messages.map((m) => m.id),
              };
            },
          };
          const summary = await assistConversation(
            p.id,
            conversation.id,
            winner,
            "summary",
            db,
            provider,
          );
          assert.ok(summary.messageIds.length);
          assert.equal(
            await db.supportMessage.count({
              where: { conversationId: conversation.id },
            }),
            before,
          );
          await assert.rejects(
            assistConversation(
              p.id,
              conversation.id,
              winner === owner.id ? member.id : owner.id,
              "draft",
              db,
              provider,
            ),
            /Take over/,
          );
          await assert.rejects(
            assistConversation(p.id, conversation.id, winner, "draft", db, {
              ...provider,
              assist: async (input) => {
                await customerMessage(
                  {
                    projectId: p.id,
                    conversationId: conversation.id,
                    customerId: customer.id,
                    content: "Another detail",
                    clientMessageId: randomUUID(),
                  },
                  db,
                );
                return { text: "Old suggestion", sources: [], messageIds: [] };
              },
            }),
            /changed/,
          );
        },
      );
      const ownerSession = await nativeLogin(owner.id);
      const memberSession = await nativeLogin(member.id);
      await db.mobileDevice.createMany({
        data: [
          {
            sessionId: ownerSession.sessionId,
            pushToken: `ExpoPushToken[owner-${suffix}]`,
            platform: "ios",
          },
          {
            sessionId: memberSession.sessionId,
            pushToken: `ExpoPushToken[member-${suffix}]`,
            platform: "android",
          },
        ],
      });
      await db.supportPushPreference.createMany({
        data: [owner.id, member.id].map((userId) => ({
          projectId: p.id,
          userId,
          enabled: true,
          onCall: true,
        })),
      });
      await t.test(
        "push reaches the assignee without foreground presence, skips read/activity and deduplicates accepted events",
        async () => {
          const requests: Record<string, any>[] = [];
          const transport: typeof fetch = async (_url, init) => {
            requests.push(JSON.parse(String(init?.body)));
            return Response.json({
              data: { status: "ok", id: `ticket-${requests.length}-${suffix}` },
            });
          };
          const event: SupportPushEvent = {
            projectId: p.id,
            conversationId: conversation.id,
            eventId: `push-${suffix}`,
            kind: "CUSTOMER_MESSAGE",
            occurredAt: new Date().toISOString(),
          };
          await deliverSupportPush(event, db, transport);
          await deliverSupportPush(event, db, transport);
          assert.equal(requests.length, 1);
          assert.equal(
            requests[0]!.to,
            `ExpoPushToken[${winner === owner.id ? "owner" : "member"}-${suffix}]`,
          );
          assert(!JSON.stringify(requests[0]).includes("Another detail"));
          assert.deepEqual(requests[0]!.data, {
            serverUrl: new URL(process.env.AUTH_URL || getSiteUrl()).origin,
            projectId: p.id,
            conversationId: conversation.id,
          });
          const sessionId =
            winner === owner.id
              ? ownerSession.sessionId
              : memberSession.sessionId;
          await db.mobileDevice.update({
            where: { sessionId },
            data: {
              activeConversationId: conversation.id,
              lastActiveAt: new Date(),
            },
          });
          await deliverSupportPush(
            { ...event, eventId: `active-${suffix}` },
            db,
            transport,
          );
          assert.equal(requests.length, 1);
          await db.mobileDevice.update({
            where: { sessionId },
            data: { activeConversationId: null },
          });
          const last = await db.supportMessage.findFirstOrThrow({
            where: { conversationId: conversation.id },
            orderBy: { createdAt: "desc" },
          });
          await markConversationRead(
            p.id,
            conversation.id,
            winner,
            last.id,
            db,
          );
          await deliverSupportPush(
            {
              ...event,
              eventId: `read-${suffix}`,
              occurredAt: new Date(0).toISOString(),
            },
            db,
            transport,
          );
          assert.equal(requests.length, 1);
          await db.supportPushDelivery.updateMany({
            where: { eventId: event.eventId },
            data: { createdAt: new Date(Date.now() - 16 * 60_000) },
          });
          const checked = await processPushReceipts(db, async () =>
            Response.json({
              data: {
                [`ticket-1-${suffix}`]: {
                  status: "error",
                  details: { error: "DeviceNotRegistered" },
                },
              },
            }),
          );
          assert.ok(checked > 0);
          assert.equal(
            (await db.mobileDevice.findUniqueOrThrow({ where: { sessionId } }))
              .enabled,
            false,
          );
        },
      );
      await t.test(
        "removed membership and resolved conversations suppress queued alerts",
        async () => {
          await teamConversationAction(
            {
              projectId: p.id,
              conversationId: conversation.id,
              actorId: owner.id,
              action: "assign",
              assigneeId: member.id,
            },
            db,
          );
          await db.mobileDevice.update({
            where: { sessionId: memberSession.sessionId },
            data: { enabled: true },
          });
          await db.projectMember.deleteMany({
            where: { projectId: p.id, userId: member.id },
          });
          const event: SupportPushEvent = {
            projectId: p.id,
            conversationId: conversation.id,
            eventId: `removed-${suffix}`,
            kind: "CUSTOMER_MESSAGE",
            occurredAt: new Date().toISOString(),
          };
          const never: typeof fetch = async () => {
            throw new Error("Must not send");
          };
          await deliverSupportPush(event, db, never);
          await teamConversationAction(
            {
              projectId: p.id,
              conversationId: conversation.id,
              actorId: owner.id,
              action: "resolve",
            },
            db,
          );
          await deliverSupportPush(event, db, never);
        },
      );
      await t.test(
        "an AI-recognized request for a person is queued on its first reply",
        async () => {
          const c = await db.supportConversation.create({
            data: { projectId: p.id, customerId: customer.id },
          });
          await customerMessage(
            {
              projectId: p.id,
              conversationId: c.id,
              customerId: customer.id,
              content: "Please let me speak to a person",
              clientMessageId: randomUUID(),
            },
            db,
          );
          await processAIConversation(
            db,
            {
              reply: async () => ({
                inScope: true,
                resolution: "escalate",
                escalationReason: "human_requested",
                issueSummary: "Customer requests a person",
                reply: "I’m passing your request to the team.",
                sources: [],
                offerTicket: true,
                handoff: true,
                ticketTitle: "Customer asks for a teammate",
                ticketType: "GENERAL",
              }),
            },
            p.id,
          );
          assert.equal(
            (
              await db.supportConversation.findUniqueOrThrow({
                where: { id: c.id },
              })
            ).state,
            "WAITING",
          );
        },
      );
    } finally {
      await db.notificationJob.deleteMany({
        where: {
          OR: [
            { payload: { path: ["projectId"], equals: p.id } },
            { payload: { path: ["project", "id"], equals: p.id } },
          ],
        },
      });
      await db.user.deleteMany({
        where: { id: { in: [owner.id, member.id, outsider.id] } },
      });
      await db.$disconnect();
    }
  },
);
