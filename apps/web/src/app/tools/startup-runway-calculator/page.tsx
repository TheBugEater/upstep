import { RunwayTool } from "../ToolApps";
import { ToolLanding, toolMetadata } from "../ToolLanding";
export const metadata = toolMetadata("Startup Runway Calculator", "Estimate startup runway from cash and monthly net burn.", "startup-runway-calculator");
export default function Page() { return <ToolLanding title="Startup Runway Calculator" description="Estimate how long existing cash will last at your current monthly net burn. Use it as a planning signal and refresh it when the business changes." points={["Use cash actually available to the company.", "Calculate net burn after recurring revenue.", "Update the estimate after hiring, revenue, or cost changes."]}><RunwayTool /></ToolLanding>; }
