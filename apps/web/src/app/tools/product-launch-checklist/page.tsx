import { LaunchTool } from "../ToolApps";
import { ToolLanding, toolMetadata } from "../ToolLanding";
export const metadata = toolMetadata("Product Launch Checklist", "Build a practical checklist for a focused product launch.", "product-launch-checklist");
export default function Page() { return <ToolLanding title="Product Launch Checklist" description="Use a focused, interactive checklist to prepare a feature or product launch—from the promise and product path to feedback and follow-up." points={["Make the primary audience and call to action unambiguous.", "Test the exact path launch visitors will take.", "Assign someone to watch questions, feedback, and defects."]}><LaunchTool /></ToolLanding>; }
