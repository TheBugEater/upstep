import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProjectAccess } from "@/lib/project-auth";
import { getSiteUrl } from "@/lib/site-url";

// A Chat link preserves the exact issue through OAuth sign-in. Unlike dashboard
// pages, this endpoint doesn't inherit a layout that redirects to generic login.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; fid: string }> }) {
  const { id, fid } = await params;
  const target = `/dashboard/projects/${encodeURIComponent(id)}/tasks/${encodeURIComponent(fid)}`;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL(`/login?returnTo=${encodeURIComponent(target)}`, getSiteUrl()));
  }
  const access = await getProjectAccess(id, session.user.id);
  if (!access || !await db.feedback.findFirst({ where: { id: fid, projectId: id }, select: { id: true } })) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.redirect(new URL(target, getSiteUrl()));
}
