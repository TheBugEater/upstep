import { PricingCopyTool } from "../ToolApps";
import { ToolLanding, toolMetadata } from "../ToolLanding";
export const metadata = toolMetadata("Pricing Page Copy Generator", "Draft benefit-led copy for a SaaS pricing plan.", "pricing-page-copy-generator");
export default function Page() { return <ToolLanding title="Pricing Page Copy Generator" description="Create a practical first draft for a pricing-plan card that helps a buyer understand who the plan is for and why they should choose it." points={["Say exactly who gets the most value from this plan.", "Describe what the plan unlocks in customer terms.", "Make the upgrade moment feel natural rather than forced."]}><PricingCopyTool /></ToolLanding>; }
