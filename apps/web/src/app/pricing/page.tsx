import type { Metadata } from "next";
import { Nav } from "@/components/marketing/Nav";
import { Footer } from "@/components/marketing/Footer";
import { Pricing } from "@/components/marketing/Pricing";
import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "Pricing. Feedback Widget Plans",
  description:
    "Upstep starts free. Collect feedback and votes with no credit card required. Upgrade for more projects, Slack integrations, and white-label branding.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Pricing | Upstep Feedback Widget",
    description:
      "Upstep starts free. Collect feedback and votes with no credit card required. Upgrade for more projects, Slack integrations, and white-label branding.",
    url: "/pricing",
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
        text: "Upstep offers three plans: Free ($0/mo), Pro ($19/mo), and Business ($49/mo). All plans include the embeddable widget, user voting, and dashboard access.",
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
      name: "Does Upstep work with React Native?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Upstep ships a dedicated React Native SDK with shake-to-feedback support, available on all plans.",
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
