import { AppStoreTool } from "../ToolApps";
import { ToolLanding, toolMetadata } from "../ToolLanding";
export const metadata = toolMetadata("App Store Description Generator", "Draft benefit-led copy for an app listing.", "app-store-description-generator");
export default function Page() { return <ToolLanding title="App Store Description Generator" description="Draft a benefit-led app listing you can edit into an App Store or Google Play description. Start with the job, then make the payoff clear." points={["Lead with the customer job instead of a feature list.", "Keep the promise concrete enough to be believable.", "Edit the draft against your real product before publishing."]}><AppStoreTool /></ToolLanding>; }
