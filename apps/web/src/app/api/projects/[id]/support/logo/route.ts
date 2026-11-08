import { NextRequest, NextResponse } from "next/server";
import { teamRequest, supportResponseError } from "@/lib/support/http";
import { supportProject } from "@/lib/support/service";
import { normalizeBusinessLogo } from "@/lib/support/branding";
import { fetchBusinessPage } from "@/lib/support/crawler";
import { SupportError } from "@/lib/support/policy";
import { checkRateLimit } from "@/lib/rate-limit";
/** Owner/admin-only image loading, so the review can normalize icons for all SDKs. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await teamRequest(req, id, true);
    await supportProject(id);
    const limit = await checkRateLimit({
      scope: "support-logo-images",
      identifier: id,
      limit: 10,
      windowMs: 60000,
    });
    if (!limit.allowed)
      throw new SupportError(
        "Please wait a moment before loading another icon.",
        429,
      );
    const url = normalizeBusinessLogo(req.nextUrl.searchParams.get("url"));
    if (!url?.startsWith("https://"))
      throw new SupportError("Use a public HTTPS image URL.");
    const image = await fetchBusinessPage(
      url,
      new URL(url).hostname.replace(/^www\./, ""),
    );
    if (
      image.status !== 200 ||
      !/^image\/(?:png|jpeg|webp|gif|x-icon|vnd\.microsoft\.icon|svg\+xml)(?:;|$)/i.test(
        image.type,
      )
    )
      throw new SupportError(
        "This URL does not provide a supported business icon. Upload a PNG, JPEG or WebP image.",
      );
    return new NextResponse(new Uint8Array(image.bytes), {
      headers: {
        "Content-Type": image.type,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy":
          "sandbox; default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:",
      },
    });
  } catch (error) {
    return supportResponseError(error);
  }
}
