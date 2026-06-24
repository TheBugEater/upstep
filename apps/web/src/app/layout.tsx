import type { Metadata } from "next";
import { Inter, Source_Serif_4, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { OnRampProvider } from "@onramp-sdk/react";
import { OnRampRouteTracker } from "@onramp-sdk/react/next";
import { UpstepWidget } from "@/components/UpstepWidget";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const serif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  style: ["normal", "italic"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Upstep | Feedback that moves you forward",
  description:
    "Drop the Upstep widget into your web or mobile app in minutes. Collect feedback, let users vote, and ship what matters.",
  twitter: {
    card: "summary_large_image",
    title: "Upstep | Feedback that moves you forward",
    description:
      "Drop the Upstep widget into your web or mobile app in minutes. Collect feedback, let users vote, and ship what matters.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
      <body>
        <OnRampProvider
          apiKey={process.env.NEXT_PUBLIC_ONRAMP_API_KEY ?? ""}
          host="https://ingest.getonramp.dev"
          appVersion="1.0.0"
        >
          <OnRampRouteTracker />
          {children}
          <UpstepWidget />
        </OnRampProvider>
      </body>
    </html>
  );
}
