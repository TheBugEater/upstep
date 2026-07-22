import { OnboardingTool } from "../ToolApps";
import { ToolLanding, toolMetadata } from "../ToolLanding";
export const metadata = toolMetadata("Onboarding Checklist Generator", "Create a focused new-user onboarding checklist.", "onboarding-checklist-generator");
export default function Page() { return <ToolLanding title="Onboarding Checklist Generator" description="Build an interactive checklist around the first outcome a new user needs to reach. It keeps onboarding focused on progress, not product-tour clutter." points={["Define one meaningful first win for the new user.", "Remove setup that is not needed for that first win.", "Measure whether users actually reach the outcome."]}><OnboardingTool /></ToolLanding>; }
