import type { Metadata } from "next";
import { SupportChat } from "@/components/support/SupportChat";
import { parseSupportAppearance } from "@/lib/support/appearance";
export const metadata: Metadata = {
  title: "Customer support",
  robots: { index: false, follow: false },
};
export default async function SupportPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { key } = await params;
  // Colors, radius and font from the SDK, validated before they reach the page.
  const appearance = parseSupportAppearance(await searchParams);
  return <SupportChat apiKey={key} appearance={appearance} />;
}
