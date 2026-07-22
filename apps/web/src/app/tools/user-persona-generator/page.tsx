import { PersonaTool } from "../ToolApps";
import { ToolLanding, toolMetadata } from "../ToolLanding";
export const metadata = toolMetadata("User Persona Generator", "Create a lean persona hypothesis to guide product research.", "user-persona-generator");
export default function Page() { return <ToolLanding title="User Persona Generator" description="Create a lean customer hypothesis with a job, trigger, constraints, objections, and an explicit plan to validate it through research." points={["Treat the persona as a hypothesis, not a fact.", "Focus on goals and constraints over demographic detail.", "Validate it with recent examples from real conversations."]}><PersonaTool /></ToolLanding>; }
