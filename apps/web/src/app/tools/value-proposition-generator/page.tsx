import { ValuePropTool } from "../ToolApps";
import { ToolLanding, toolMetadata } from "../ToolLanding";
export const metadata = toolMetadata("Value Proposition Generator", "Create focused value proposition copy for a product and audience.", "value-proposition-generator");
export default function Page() { return <ToolLanding title="Value Proposition Generator" description="Find a sharper way to say why your product matters. Use the draft as a homepage starting point, then refine it with customer language." points={["Be specific about the audience you serve.", "Make the outcome more prominent than the mechanism.", "Remove claims you cannot prove with a real example."]}><ValuePropTool /></ToolLanding>; }
