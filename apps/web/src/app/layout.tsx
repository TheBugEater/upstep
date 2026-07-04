import type { Metadata } from "next";
import { Inter, Source_Serif_4, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { OnRampProvider } from "@onramp-sdk/react";
import { OnRampRouteTracker } from "@onramp-sdk/react/next";
import { auth } from "@/lib/auth";
import { OnRampIdentify } from "@/components/OnRampIdentify";

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

const BASE_URL = (process.env.AUTH_URL ?? "https://upstep.dev").replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Upstep — Feedback Widget & Voting for Web and Mobile Apps",
    template: "%s | Upstep",
  },
  description:
    "Add a feedback and voting widget to your web or mobile app in 2 lines of code. Let users submit ideas, report bugs, and vote on features. Free plan available.",
  openGraph: {
    siteName: "Upstep",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    site: "@upstepdev",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* Set the theme class before first paint to avoid a flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("upstep:theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`,
          }}
        />
      </head>
      <body>
        <OnRampProvider
          apiKey={process.env.NEXT_PUBLIC_ONRAMP_API_KEY ?? ""}
          host="https://ingest.getonramp.dev"
          appVersion="1.0.0"
        >
          <OnRampRouteTracker />
          {session?.user?.email && (
            <OnRampIdentify email={session.user.email} />
          )}
          {children}
        </OnRampProvider>
      </body>
    </html>
  );
}
