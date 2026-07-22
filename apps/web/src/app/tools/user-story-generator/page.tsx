import { UserStoryTool } from "../ToolApps";
import { ToolLanding, toolMetadata } from "../ToolLanding";
export const metadata = toolMetadata("User Story Generator", "Generate a user story and testable acceptance criteria.", "user-story-generator");
export default function Page() { return <ToolLanding title="User Story Generator" description="Turn a feature idea into a usable story with a customer outcome and starter acceptance criteria your team can discuss before building." points={["Start with a real role, not a generic user.", "Describe the job they need to complete.", "Add criteria that prove the job is genuinely done."]}><UserStoryTool /></ToolLanding>; }
