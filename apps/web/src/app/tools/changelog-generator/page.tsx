import { ChangelogTool } from "../ToolApps";
import { ToolLanding, toolMetadata } from "../ToolLanding";
export const metadata = toolMetadata("Changelog Generator", "Create a concise product changelog entry.", "changelog-generator");
export default function Page() { return <ToolLanding title="Changelog Generator" description="Draft a concise product update that gives a change a clear headline, customer context, and an invitation to use the new capability." points={["State the update in words customers recognise.", "Connect the change to the friction it removes.", "Keep the note short enough to read in a product feed."]}><ChangelogTool /></ToolLanding>; }
