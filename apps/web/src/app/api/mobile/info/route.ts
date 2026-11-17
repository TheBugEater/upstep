import { NextResponse } from "next/server";

// Public compatibility handshake; no tenant, account or configuration data.
export async function GET() {
  return NextResponse.json(
    { product: "upstep", mobileApiVersion: 1 },
    { headers: { "Cache-Control": "no-store" } },
  );
}
