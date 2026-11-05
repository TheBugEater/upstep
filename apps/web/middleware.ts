import { withOnRampCrawlerTracking } from "@onramp-sdk/react/next";
import { NextResponse } from "next/server";

const apiKey = process.env.NEXT_PUBLIC_ONRAMP_API_KEY;

// Crawlers do not run the client SDK, so report their visits at the edge.
export default apiKey
  ? withOnRampCrawlerTracking({ apiKey })
  : () => NextResponse.next();

export const config = {
  // The invitation exchange URL contains a secret; never report it to analytics.
  matcher: "/((?!_next/static|_next/image|favicon.ico|api/invitations/open).*)",
};
