import type { Metadata } from "next";
import { Nav } from "@/components/marketing/Nav";
import { Footer } from "@/components/marketing/Footer";
import { Pricing } from "@/components/marketing/Pricing";

export const metadata: Metadata = {
  title: "Pricing — Upstep",
  description: "Simple, scalable pricing for feedback that moves you forward.",
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-canvas">
      <Nav />
      <div className="pt-10">
        <Pricing />
      </div>
      <Footer />
    </div>
  );
}
