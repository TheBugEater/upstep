"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { acceptProjectInvitation, InvitationError } from "@/lib/project-invitations";
import { invitationCookieName } from "@/lib/invitation-tokens";

export async function acceptInvitation(id: string) {
  const session = await auth();
  const path = `/invite/${encodeURIComponent(id)}`;
  if (!session?.user?.id || !session.user.email) redirect(`/login?returnTo=${encodeURIComponent(path)}`);
  const jar = await cookies();
  const token = jar.get(invitationCookieName(id))?.value ?? "";
  const userId = session.user.id;
  const email = session.user.email;
  let projectId: string;
  try {
    projectId = await db.$transaction((tx) => acceptProjectInvitation({
      invitationId: id, token, userId, email,
    }, tx));
  } catch (error) {
    if (error instanceof InvitationError) redirect(`${path}?error=${error.code}`);
    throw error;
  }
  jar.delete(invitationCookieName(id));
  redirect(`/dashboard/projects/${projectId}`);
}

export async function switchInvitationAccount(id: string) {
  await signOut({ redirectTo: `/invite/${encodeURIComponent(id)}` });
}
