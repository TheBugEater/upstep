import type { Metadata } from "next";
import { Nav } from "@/components/marketing/Nav";
import { Footer } from "@/components/marketing/Footer";
import { Pricing } from "@/components/marketing/Pricing";
import { JsonLd } from "@/components/JsonLd";
import { formatPrice } from "@/lib/plans";

const DESCRIPTION =
  "Start with free feedback and voting. Pro and Business add AI chat, live support, a shared inbox and private tickets.";

export const metadata: Metadata = {
  title: "Pricing for Feedback and Chat Support",
  description: DESCRIPTION,
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Pricing for Feedback and Chat Support | Upstep",
    description: DESCRIPTION,
    url: "/pricing",
    images: ["/opengraph-image"],
  },
};

const PRICING_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Is there a free plan?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. The Free plan includes 1 project, up to 100 feedback items, and the full feedback and voting widget with no credit card required.",
      },
    },
    {
      "@type": "Question",
      name: "How much does Upstep cost?",
      acceptedAnswer: {
        "@type": "Answer",
        text: `In USD, Free is ${formatPrice("FREE", "USD")}, Pro is ${formatPrice("PRO", "USD")} per month and Business is ${formatPrice("BUSINESS", "USD")} per month. All plans include feedback and voting.`,
      },
    },
    {
      "@type": "Question",
      name: "Which plans include Chat Support?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Pro and Business include AI chat, live support, a shared inbox and private tickets.",
      },
    },
    {
      "@type": "Question",
      name: "Can I remove the Upstep branding?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Business plan subscribers can remove the 'Powered by Upstep' badge from the widget and use their own branding.",
      },
    },
    {
      "@type": "Question",
      name: "Does Upstep work with React Native or Flutter?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Upstep ships dedicated React Native and Flutter SDKs for mobile apps, available on all plans.",
      },
    },
  ],
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-canvas">
      <JsonLd data={PRICING_LD} />
      <Nav />
      <div className="pt-10">
        <Pricing />
      </div>
      <Footer />
    </div>
  );
}
