import { ElevatorPitchTool } from "../ToolApps";
import { ToolLanding, toolMetadata } from "../ToolLanding";
export const metadata = toolMetadata("Elevator Pitch Generator", "Draft a clear startup pitch for a product and its audience.", "elevator-pitch-generator");
export default function Page() { return <ToolLanding title="Elevator Pitch Generator" description="Write a concise startup pitch for a demo, landing page, investor introduction, or launch post—without falling back on vague category jargon." points={["Start with the people who have the problem.", "Explain the new approach in everyday language.", "End with the useful result, not a list of capabilities."]}><ElevatorPitchTool /></ToolLanding>; }
