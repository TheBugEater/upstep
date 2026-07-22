import { FeatureRequestTool } from "../ToolApps";
import { ToolLanding, toolMetadata } from "../ToolLanding";
export const metadata = toolMetadata("Feature Request Template", "Create a structured feature request your team can evaluate.", "feature-request-template");
export default function Page() { return <ToolLanding title="Feature Request Template" description="Capture a customer request with the context a product team needs: the problem, desired outcome, workaround, and evidence of impact." points={["Document the problem before proposing a solution.", "Ask what people do today when the product falls short.", "Attach customer evidence, frequency, and account impact."]}><FeatureRequestTool /></ToolLanding>; }
