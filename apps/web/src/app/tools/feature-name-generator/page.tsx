import { FeatureNameTool } from "../ToolApps";
import { ToolLanding, toolMetadata } from "../ToolLanding";
export const metadata = toolMetadata("Feature Name Generator", "Turn a feature brief into concise, product-ready feature names.", "feature-name-generator");
export default function Page() { return <ToolLanding title="Feature Name Generator" description="Turn a rough feature brief into clear options your customers can understand in navigation, release notes, and product tours." points={["Name the customer outcome, not the implementation detail.", "Prefer a short label people can recognise at a glance.", "Use the same words your customers use in interviews and requests."]}><FeatureNameTool /></ToolLanding>; }
