import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock, test } from "node:test";
import { PrismaClient, type Prisma } from "@prisma/client";
import { createProjectInvitation, acceptProjectInvitation } from "./project-invitations";
import { hashInvitationToken, INVITATION_LIFETIME_MS } from "./invitation-tokens";
import { processNotificationJobs } from "./notification-queue";
import type { ProjectInvitationPayload } from "./email";

const databaseUrl = process.env.UPSTEP_INVITATION_TEST_DATABASE_URL;

test("project invitation database lifecycle", { skip: !databaseUrl }, async (t) => {
  // Explicitly opted-in local/CI database only. Never run fixtures against production.
  const url = new URL(databaseUrl!);
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname));
  assert.ok(url.pathname.endsWith("_test") || url.pathname === "/build");
  const client = new PrismaClient({ datasourceUrl: databaseUrl! });
  const originalEnv = { ...process.env };
  process.env.SENDPANDA_API_KEY = "test-only-key";
  delete process.env.SENDPANDA_INVITATION_TEMPLATE_ID;
  const sent: { to: string[]; text: string }[] = [];
  mock.method(globalThis, "fetch", async (_url: RequestInfo | URL, init?: RequestInit) => {
    // No test can reach SendPanda or deliver to a fixture address.
    sent.push(JSON.parse(init?.body as string));
    return new Response(null, { status: 202 });
  });
  t.after(async () => {
    mock.restoreAll();
    for (const name of ["SENDPANDA_API_KEY", "SENDPANDA_INVITATION_TEMPLATE_ID"]) {
      if (originalEnv[name] === undefined) delete process.env[name];
      else process.env[name] = originalEnv[name];
    }
    await client.$disconnect();
  });
  const owner = await client.user.create({ data: { email: `owner-${randomUUID()}@example.test`, name: "Owner" } });
  const project = await client.project.create({ data: { name: "Invitation test", slug: `invite-${randomUUID()}`, ownerId: owner.id } });
  const base = { projectId: project.id, projectName: project.name, inviterName: owner.name };
  // Parallel collaboration tests queue their own jobs. This suite must neither
  // deliver those jobs nor compare counts that other suites can change.
  const jobScope: Prisma.NotificationJobWhereInput = { payload: { path: ["projectId"], equals: project.id } };
  const deliveryQueue = new Proxy(client.notificationJob, {
    get(target, property) {
      if (property === "findMany") return (args: Prisma.NotificationJobFindManyArgs) => target.findMany({ ...args, where: { AND: [args.where ?? {}, jobScope] } });
      if (property === "updateMany") return (args: Prisma.NotificationJobUpdateManyArgs) => target.updateMany({ ...args, where: { AND: [args.where ?? {}, jobScope] } });
      if (property === "deleteMany") return (args: Prisma.NotificationJobDeleteManyArgs) => target.deleteMany({ ...args, where: { AND: [args.where ?? {}, jobScope] } });
      return Reflect.get(target, property);
    },
  });
  const deliveryClient = new Proxy(client, {
    get(target, property) { return property === "notificationJob" ? deliveryQueue : Reflect.get(target, property); },
  });
  async function invite() {
    const email = `invite-${randomUUID()}@example.test`;
    const result = await client.$transaction((tx) => createProjectInvitation({ ...base, email }, tx));
    assert.ok(result.invitation);
    const record = await client.projectInvitation.findUniqueOrThrow({ where: { id: result.invitation!.id } });
    const job = await client.notificationJob.findFirstOrThrow({ where: { payload: { path: ["invitationId"], equals: record.id } } });
    const payload = job.payload as unknown as ProjectInvitationPayload;
    return { email, result, record, payload };
  }
  async function accept(record: { id: string }, payload: ProjectInvitationPayload, user: { id: string; email: string }, now?: Date) {
    return client.$transaction((tx) => acceptProjectInvitation({
      invitationId: record.id, token: payload.token, userId: user.id, email: user.email,
    }, tx, now));
  }

  await t.test("invite before signup, then create an account and accept with the invited email", async () => {
    const { email, result, record, payload } = await invite();
    assert.equal(await client.user.count({ where: { email } }), 0);
    assert.equal(await client.projectMember.count({ where: { projectId: project.id } }), 0);
    assert.equal(record.tokenHash, hashInvitationToken(payload.token));
    assert.notEqual(record.tokenHash, payload.token);
    assert.equal(record.expiresAt.getTime() - record.lastSentAt.getTime(), INVITATION_LIFETIME_MS);
    assert.ok(!("tokenHash" in result.invitation!));
    const wrongUser = await client.user.create({ data: { email: `wrong-${randomUUID()}@example.test` } });
    await assert.rejects(accept(record, payload, wrongUser), /wrong-account/);
    const user = await client.user.create({ data: { email, name: "New teammate" } });
    assert.equal(await accept(record, payload, user), project.id);
    assert.equal(await accept(record, payload, user), project.id);
    assert.equal(await client.projectMember.count({ where: { projectId: project.id, userId: user.id } }), 1);
    // An already accepted invite must never regrant access after a removal.
    await client.projectMember.deleteMany({ where: { projectId: project.id, userId: user.id } });
    await assert.rejects(accept(record, payload, user), /invalid/);
  });

  await t.test("concurrent invitations normalize the email and enqueue only once", async () => {
    const email = `concurrent-${randomUUID()}@example.test`;
    const results = await Promise.all([
      client.$transaction((tx) => createProjectInvitation({ ...base, email: ` ${email.toUpperCase()} ` }, tx)),
      client.$transaction((tx) => createProjectInvitation({ ...base, email }, tx)),
    ]);
    assert.equal(results.filter((r) => r.emailQueued).length, 1);
    assert.equal(await client.projectInvitation.count({ where: { projectId: project.id, email } }), 1);
    assert.equal(await client.notificationJob.count({ where: { payload: { path: ["invitationId"], equals: results[0]!.invitation!.id } } }), 1);
  });

  await t.test("expiry, revocation, and replacement tokens prevent acceptance and stale sends", async () => {
    const expired = await invite();
    const expiredUser = await client.user.create({ data: { email: expired.email } });
    await assert.rejects(accept(expired.record, expired.payload, expiredUser, new Date(expired.record.expiresAt.getTime() + 1)), /expired/);
    await client.projectInvitation.update({ where: { id: expired.record.id }, data: { expiresAt: new Date(0) } });

    const revoked = await invite();
    const revokedUser = await client.user.create({ data: { email: revoked.email } });
    await client.projectInvitation.update({ where: { id: revoked.record.id }, data: { revokedAt: new Date() } });
    await assert.rejects(accept(revoked.record, revoked.payload, revokedUser), /invalid/);

    const replaced = await invite();
    await assert.rejects(client.$transaction((tx) => createProjectInvitation({ ...base, email: replaced.email, resend: true }, tx)), /resend-too-soon/);
    const afterCooldown = new Date(replaced.record.lastSentAt.getTime() + 61_000);
    await client.$transaction((tx) => createProjectInvitation({ ...base, email: replaced.email, resend: true }, tx, afterCooldown));
    const replacedUser = await client.user.create({ data: { email: replaced.email } });
    await assert.rejects(accept(replaced.record, replaced.payload, replacedUser), /invalid/);
    const latest = await client.projectInvitation.findUniqueOrThrow({ where: { id: replaced.record.id } });
    assert.notEqual(latest.tokenHash, replaced.record.tokenHash);

    await processNotificationJobs(100, deliveryClient);
    assert.ok(!sent.some((email) => email.to.includes(expired.email)));
    assert.ok(!sent.some((email) => email.to.includes(revoked.email)));
    const replacementSends = sent.filter((email) => email.to.includes(replaced.email));
    assert.equal(replacementSends.length, 1);
    assert.ok(!replacementSends[0]!.text.includes(replaced.payload.token));
  });

  await t.test("a transaction rollback leaves neither the invitation nor its email job", async () => {
    const email = `rollback-${randomUUID()}@example.test`;
    const beforeJobs = await client.notificationJob.count({ where: jobScope });
    await assert.rejects(client.$transaction(async (tx) => {
      await createProjectInvitation({ ...base, email }, tx);
      throw new Error("Forced rollback");
    }), /Forced rollback/);
    assert.equal(await client.projectInvitation.count({ where: { email } }), 0);
    assert.equal(await client.notificationJob.count({ where: jobScope }), beforeJobs);
  });

  await t.test("concurrent accepts create just one membership and existing members aren't reinvited", async () => {
    const { email, record, payload } = await invite();
    const user = await client.user.create({ data: { email } });
    assert.deepEqual(await Promise.all([accept(record, payload, user), accept(record, payload, user)]), [project.id, project.id]);
    assert.equal(await client.projectMember.count({ where: { projectId: project.id, userId: user.id } }), 1);
    const result = await client.$transaction((tx) => createProjectInvitation({ ...base, email }, tx));
    assert.equal(result.alreadyMember, true);
    assert.equal(result.emailQueued, false);
  });

  await t.test("provider failures retry the same invitation with its original UUID", async () => {
    const { record, payload } = await invite();
    const keys: string[] = [];
    mock.method(globalThis, "fetch", async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string);
      if (body.to.includes(payload.toEmail)) {
        keys.push(new Headers(init?.headers).get("Idempotency-Key")!);
        return new Response(null, { status: keys.length === 1 ? 503 : 202 });
      }
      return new Response(null, { status: 202 });
    });
    await processNotificationJobs(100, deliveryClient);
    const job = await client.notificationJob.findFirstOrThrow({ where: { payload: { path: ["invitationId"], equals: record.id } } });
    assert.equal(job.status, "PENDING");
    await client.notificationJob.update({ where: { id: job.id }, data: { availableAt: new Date(0) } });
    await processNotificationJobs(100, deliveryClient);
    assert.equal(keys.length, 2);
    assert.equal(keys[0], keys[1]);
    assert.equal(keys[0], (job.payload as unknown as ProjectInvitationPayload).idempotencyKey);
    assert.equal((await client.notificationJob.findUniqueOrThrow({ where: { id: job.id } })).status, "COMPLETED");
  });
});
