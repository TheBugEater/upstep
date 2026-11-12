import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { queueEmail } from "./notification-queue";
import type { FeedbackNotificationPayload, TaskActivityPayload } from "./email";

export type EmailPrefs = { newFeedback: boolean; assigned: boolean; comments: boolean; statusChanges: boolean };
type StoredPrefs = { newFeedback: boolean | null; assigned: boolean; comments: boolean; statusChanges: boolean } | null;
type Client = Pick<Prisma.TransactionClient, "project" | "emailPreference" | "notificationJob">;

/** A missing row means defaults: the owner hears about new feedback (as before
 *  this setting existed), everyone hears about their own assignments and
 *  comments, and nobody gets status-change mail unless they opt in. */
export function resolveEmailPrefs(stored: StoredPrefs, isOwner: boolean): EmailPrefs {
  return {
    newFeedback: stored?.newFeedback ?? isOwner,
    assigned: stored?.assigned ?? true,
    comments: stored?.comments ?? true,
    statusChanges: stored?.statusChanges ?? false,
  };
}

async function projectPeople(projectId: string, client: Client) {
  const project = await client.project.findUnique({
    where: { id: projectId },
    select: {
      name: true,
      ownerId: true,
      owner: { select: { id: true, email: true } },
      members: { select: { user: { select: { id: true, email: true } } } },
      emailPreferences: true,
    },
  });
  if (!project) return null;
  const people = [project.owner, ...project.members.map((m) => m.user)].filter((p, i, all) => all.findIndex((q) => q.id === p.id) === i);
  return {
    name: project.name,
    people: people.map((p) => ({
      ...p,
      prefs: resolveEmailPrefs(project.emailPreferences.find((e) => e.userId === p.id) ?? null, p.id === project.ownerId),
    })),
  };
}

/** New feedback from the widget: everyone on the project who has it switched on. */
export async function queueNewFeedbackEmails(projectId: string, feedback: FeedbackNotificationPayload["feedback"], client: Client = db) {
  const project = await projectPeople(projectId, client);
  if (!project) return;
  await Promise.all(project.people.filter((p) => p.prefs.newFeedback).map((p) =>
    queueEmail({ toEmail: p.email, projectName: project.name, projectId, feedback }, client)));
}

const PREF_FOR: Record<TaskActivityPayload["event"], keyof EmailPrefs> = { ASSIGNED: "assigned", COMMENT: "comments", STATUS: "statusChanges" };

/** One person hears about activity on their task, unless they caused it,
 *  no longer have access to the project, or switched that email off. */
export async function queueTaskActivityEmail(input: {
  projectId: string;
  recipientId: string | null | undefined;
  actorId: string | null | undefined;
  actorName: string;
  event: TaskActivityPayload["event"];
  task: { id: string; title: string | null; content: string };
  detail?: string;
}, client: Client = db) {
  if (!input.recipientId || input.recipientId === input.actorId) return false;
  const project = await projectPeople(input.projectId, client);
  const recipient = project?.people.find((p) => p.id === input.recipientId);
  if (!project || !recipient || !recipient.prefs[PREF_FOR[input.event]]) return false;
  await queueEmail({
    kind: "TASK_ACTIVITY",
    event: input.event,
    toEmail: recipient.email,
    projectName: project.name,
    projectId: input.projectId,
    taskId: input.task.id,
    taskTitle: input.task.title?.trim() || input.task.content,
    actorName: input.actorName,
    ...(input.detail ? { detail: input.detail } : {}),
  }, client);
  return true;
}
