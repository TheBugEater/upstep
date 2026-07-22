import { BugReportTool } from "../ToolApps";
import { ToolLanding, toolMetadata } from "../ToolLanding";
export const metadata = toolMetadata("Bug Report Template", "Create a clear, reproducible bug report.", "bug-report-template");
export default function Page() { return <ToolLanding title="Bug Report Template" description="Turn a vague report into a concise issue someone can reproduce, triage, and fix without a long clarification loop." points={["Record the shortest reliable reproduction path.", "Separate expected behaviour from what actually happened.", "Include browser, device, account, and error context."]}><BugReportTool /></ToolLanding>; }
