import type { Metadata } from "next";
import { SupportChat } from "@/components/support/SupportChat";
export const metadata: Metadata = {
  title: "Customer support",
  robots: { index: false, follow: false },
};
export default async function SupportPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  return <SupportChat apiKey={key} />;
}
