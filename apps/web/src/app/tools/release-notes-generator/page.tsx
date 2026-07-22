import { ReleaseNotesTool } from "../ToolApps";
import { ToolLanding, toolMetadata } from "../ToolLanding";
export const metadata = toolMetadata("Release Notes Generator", "Draft useful, customer-friendly release notes.", "release-notes-generator");
export default function Page() { return <ToolLanding title="Release Notes Generator" description="Write release notes that tell users what changed, why it matters, and the next action they can take—without shipping a wall of implementation detail." points={["Lead with a scannable, customer-facing headline.", "Explain the practical benefit of the change.", "Tell users where to try it or what to do next."]}><ReleaseNotesTool /></ToolLanding>; }
