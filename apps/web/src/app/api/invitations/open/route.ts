import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashInvitationToken, invitationCookieName, isInvitationToken } from "@/lib/invitation-tokens";
import { getSiteUrl } from "@/lib/site-url";

/** Exchange the email-link secret for an HttpOnly cookie before rendering analytics/UI. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const invitation = isInvitationToken(token) ? await db.projectInvitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) }, select: { id: true, expiresAt: true },
  }) : null;
  const response = NextResponse.redirect(`${getSiteUrl()}/invite/${invitation?.id ?? "invalid"}`);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  if (invitation) response.cookies.set(invitationCookieName(invitation.id), token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/",
    maxAge: Math.max(60, Math.ceil((invitation.expiresAt.getTime() - Date.now()) / 1000)),
  });
  return response;
}
