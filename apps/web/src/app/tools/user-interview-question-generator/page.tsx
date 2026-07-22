import { InterviewTool } from "../ToolApps";
import { ToolLanding, toolMetadata } from "../ToolLanding";
export const metadata = toolMetadata("User Interview Question Generator", "Generate open-ended product research interview questions.", "user-interview-question-generator");
export default function Page() { return <ToolLanding title="User Interview Question Generator" description="Prepare an interview guide that uncovers behaviour, context, friction, and customer language—without leading people toward your idea." points={["Ask about past behaviour instead of future intent.", "Let the interviewee narrate the workflow step by step.", "Write down their exact words for later product copy."]}><InterviewTool /></ToolLanding>; }
