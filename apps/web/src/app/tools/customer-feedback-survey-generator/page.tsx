import { SurveyTool } from "../ToolApps";
import { ToolLanding, toolMetadata } from "../ToolLanding";
export const metadata = toolMetadata("Customer Feedback Survey Generator", "Generate a focused customer feedback survey.", "customer-feedback-survey-generator");
export default function Page() { return <ToolLanding title="Customer Feedback Survey Generator" description="Create a short survey that gets beyond opinions and into what customers actually did, where they got stuck, and what they tried instead." points={["Ask about a recent real moment, not a hypothetical.", "Use open questions before asking for ratings.", "Invite follow-up conversations with willing respondents."]}><SurveyTool /></ToolLanding>; }
