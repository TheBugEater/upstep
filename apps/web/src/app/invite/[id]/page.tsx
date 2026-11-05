import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashInvitationToken, invitationCookieName, isInvitationToken } from "@/lib/invitation-tokens";
import { Logo } from "@/components/Logo";
import { acceptInvitation, switchInvitationAccount } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Project invitation", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function InvitationPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const token = (await cookies()).get(invitationCookieName(id))?.value ?? "";
  const invitation = isInvitationToken(token) ? await db.projectInvitation.findFirst({
    where: { id, tokenHash: hashInvitationToken(token) },
    include: { project: { select: { name: true, owner: { select: { name: true } } } } },
  }) : null;
  const session = await auth();
  const invalid = !invitation || !!invitation.revokedAt || error === "invalid";
  const expired = invitation && !invitation.acceptedAt && (invitation.expiresAt <= new Date() || error === "expired");
  const wrongAccount = session?.user?.email && invitation && session.user.email.trim().toLowerCase() !== invitation.email;
  const returnPath = `/invite/${encodeURIComponent(id)}`;
  return (
    <main className="min-h-screen bg-canvas px-6 py-10">
      <div className="mx-auto max-w-lg">
        <Logo />
        <section className="mt-16 rounded-2xl border border-line bg-card p-8 shadow-soft">
          {invalid || expired ? <>
            <h1 className="font-serif text-3xl text-ink">{expired ? "This invitation has expired" : "This invitation is unavailable"}</h1>
            <p className="mt-4 text-sm leading-relaxed text-muted">{expired ? "Invitations last seven days. Ask the project owner to send you a new invitation." : "Open the latest invitation from your email. If it was revoked or replaced, ask the project owner for a new one."}</p>
            <Link href="/" className="mt-6 inline-block text-sm text-ink underline">Back to UpStep</Link>
          </> : <>
            <p className="text-sm font-medium text-muted">Project invitation</p>
            <h1 className="mt-2 font-serif text-3xl text-ink">Join {invitation!.project.name}</h1>
            <p className="mt-4 text-sm leading-relaxed text-muted">{invitation!.project.owner.name || "The project owner"} invited <strong className="text-ink">{invitation!.email}</strong> to collaborate on this project.</p>
            {!session?.user?.id ? <>
              <p className="mt-4 text-sm leading-relaxed text-muted">New to UpStep? Continuing with Google or GitHub creates your account automatically. Use the email address that received this invitation.</p>
              <Link href={`/login?returnTo=${encodeURIComponent(returnPath)}`} className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-fg">Sign in or create an account →</Link>
            </> : wrongAccount || error === "wrong-account" ? <>
              <p className="mt-4 text-sm leading-relaxed text-muted">You're signed in as <strong className="text-ink">{session.user.email}</strong>. Switch to the invited email address to join.</p>
              <form action={switchInvitationAccount.bind(null, id)}><button className="mt-6 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-fg">Switch account</button></form>
            </> : <>
              <p className="mt-4 text-sm leading-relaxed text-muted">You'll be able to view and triage feedback. Project settings stay with the owner.</p>
              <form action={acceptInvitation.bind(null, id)}><button className="mt-6 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-fg">{invitation!.acceptedAt ? "Open project →" : "Accept invitation →"}</button></form>
            </>}
          </>}
        </section>
      </div>
    </main>
  );
}
