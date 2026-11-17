import { NextRequest, NextResponse } from "next/server";
import { mobileRequest } from "@/lib/mobile/auth";
import {
  mobileInbox,
  INBOX_FILTERS,
  type InboxFilter,
} from "@/lib/mobile/inbox";
import { supportResponseError } from "@/lib/support/http";
import { SupportError } from "@/lib/support/policy";
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { userId } = await mobileRequest(req);
    const filter = req.nextUrl.searchParams.get("filter") || "needs_human";
    const cursor = req.nextUrl.searchParams.get("cursor") || undefined;
    if (
      !(INBOX_FILTERS as readonly string[]).includes(filter) ||
      (cursor && cursor.length > 500)
    )
      throw new SupportError("Invalid inbox filter.");
    return NextResponse.json(
      await mobileInbox(id, userId, filter as InboxFilter, cursor),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return supportResponseError(e);
  }
}
