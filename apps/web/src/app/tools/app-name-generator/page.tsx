import { AppNameTool } from "../ToolApps";
import { ToolLanding, toolMetadata } from "../ToolLanding";
export const metadata = toolMetadata("App Name Generator", "Generate distinctive app-name ideas from your product idea and preferred tone.", "app-name-generator");
export default function Page() { return <ToolLanding title="App Name Generator" description="Generate short, memorable names for the app you are actually building. Copy any candidate, then validate it with customers, domains, and trademark checks." points={["Describe the job your app helps someone complete.", "Use the tone field to steer the names toward your category.", "Treat every result as a starting point and validate it before launch."]}><AppNameTool /></ToolLanding>; }
