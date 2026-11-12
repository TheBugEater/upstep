import assert from "node:assert/strict";
import { test } from "node:test";
import type { Prisma } from "@prisma/client";
import { queueNewFeedbackEmails, queueTaskActivityEmail, resolveEmailPrefs } from "./email-notifications";
import { taskActivityEmail } from "./email";

type Pref = { userId: string; newFeedback: boolean | null; assigned: boolean; comments: boolean; statusChanges: boolean };

function fakeClient(prefs: Pref[] = []) {
  const queued: { toEmail: string; kind?: string; event?: string; detail?: string }[] = [];
  const client = {
    project: {
      findUnique: async () => ({
        name: "Acme",
        ownerId: "owner",
        owner: { id: "owner", email: "owner@example.com" },
        members: [{ user: { id: "maya", email: "maya@example.com" } }, { user: { id: "jon", email: "jon@example.com" } }],
        emailPreferences: prefs,
      }),
    },
    notificationJob: { create: async ({ data }: { data: { payload: never } }) => { queued.push(data.payload); return data; } },
    emailPreference: {},
  } as unknown as Pick<Prisma.TransactionClient, "project" | "emailPreference" | "notificationJob">;
  return { client, queued };
}

const task = { id: "t1", title: "Dark mode for the widget", content: "Details" };

test("defaults keep today's behaviour: only the owner hears about new feedback", () => {
  assert.deepEqual(resolveEmailPrefs(null, true), { newFeedback: true, assigned: true, comments: true, statusChanges: false });
  assert.deepEqual(resolveEmailPrefs(null, false), { newFeedback: false, assigned: true, comments: true, statusChanges: false });
  assert.equal(resolveEmailPrefs({ newFeedback: null, assigned: false, comments: true, statusChanges: true }, true).newFeedback, true);
});

test("new feedback goes to everyone who switched it on, and not to whoever switched it off", async () => {
  const { client, queued } = fakeClient([
    { userId: "owner", newFeedback: false, assigned: true, comments: true, statusChanges: false },
    { userId: "maya", newFeedback: true, assigned: true, comments: true, statusChanges: false },
  ]);
  await queueNewFeedbackEmails("p1", { title: "Hi", content: "Hello", type: "BUG", flagged: false, status: "OPEN" }, client);
  assert.deepEqual(queued.map((q) => q.toEmail), ["maya@example.com"]);
});

test("task activity reaches the assignee, never the person who acted", async () => {
  const { client, queued } = fakeClient();
  assert.equal(await queueTaskActivityEmail({ projectId: "p1", recipientId: "maya", actorId: "maya", actorName: "Maya", event: "ASSIGNED", task }, client), false);
  assert.equal(await queueTaskActivityEmail({ projectId: "p1", recipientId: null, actorId: "jon", actorName: "Jon", event: "COMMENT", task }, client), false);
  assert.equal(await queueTaskActivityEmail({ projectId: "p1", recipientId: "maya", actorId: "jon", actorName: "Jon", event: "COMMENT", task, detail: "Looks good" }, client), true);
  assert.equal(queued.length, 1);
  assert.equal(queued[0]!.toEmail, "maya@example.com");
  assert.equal(queued[0]!.kind, "TASK_ACTIVITY");
  assert.equal(queued[0]!.detail, "Looks good");
});

test("people who left the project or switched an email off get nothing", async () => {
  const { client, queued } = fakeClient([{ userId: "maya", newFeedback: false, assigned: true, comments: true, statusChanges: false }]);
  // Status changes are off by default.
  assert.equal(await queueTaskActivityEmail({ projectId: "p1", recipientId: "maya", actorId: "jon", actorName: "Jon", event: "STATUS", task }, client), false);
  assert.equal(await queueTaskActivityEmail({ projectId: "p1", recipientId: "former-member", actorId: "jon", actorName: "Jon", event: "ASSIGNED", task }, client), false);
  assert.equal(queued.length, 0);
});

test("activity emails link to the task page and the email settings, and escape user text", () => {
  const email = taskActivityEmail({ kind: "TASK_ACTIVITY", event: "COMMENT", toEmail: "maya@example.com", projectName: "Acme", projectId: "p1", taskId: "t1", taskTitle: "Fix <script>", actorName: "Jon", detail: "Looks <b>good</b>" });
  assert.equal(email.subject, "New comment: Fix <script>");
  assert.match(email.text, /\/dashboard\/projects\/p1\/tasks\/t1/);
  assert.match(email.text, /tab=settings&panel=email/);
  assert.ok(!email.html.includes("<script>"));
  assert.ok(email.html.includes("Looks &lt;b&gt;good&lt;/b&gt;"));
});
