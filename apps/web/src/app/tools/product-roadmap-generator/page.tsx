import { RoadmapTool } from "../ToolApps";
import { ToolLanding, toolMetadata } from "../ToolLanding";
export const metadata = toolMetadata("Product Roadmap Generator", "Create an outcome-led Now, Next, Later product roadmap.", "product-roadmap-generator");
export default function Page() { return <ToolLanding title="Product Roadmap Generator" description="Shape a roadmap around outcomes rather than a long, brittle feature list. Copy the result into a planning doc, presentation, or public roadmap." points={["Use Now for the outcome that matters most today.", "Use Next for the bottleneck that follows it.", "Avoid dates until you can make a credible commitment."]}><RoadmapTool /></ToolLanding>; }
