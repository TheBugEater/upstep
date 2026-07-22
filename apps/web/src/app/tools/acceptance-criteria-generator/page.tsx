import { AcceptanceTool } from "../ToolApps";
import { ToolLanding, toolMetadata } from "../ToolLanding";
export const metadata = toolMetadata("Acceptance Criteria Generator", "Generate testable acceptance criteria for a feature.", "acceptance-criteria-generator");
export default function Page() { return <ToolLanding title="Acceptance Criteria Generator" description="Use a rough feature description to produce a build-ready starting point: primary flow, constraints, error handling, and a definition of done." points={["Cover the successful path before edge cases.", "State constraints a developer or tester could verify.", "Decide what ‘done’ means beyond code being merged."]}><AcceptanceTool /></ToolLanding>; }
