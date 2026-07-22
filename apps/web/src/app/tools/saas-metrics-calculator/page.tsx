import { SaaSMetricsTool } from "../ToolApps";
import { ToolLanding, toolMetadata } from "../ToolLanding";
export const metadata = toolMetadata("SaaS Metrics Calculator", "Calculate MRR, ARR, and simple monthly retention.", "saas-metrics-calculator");
export default function Page() { return <ToolLanding title="SaaS Metrics Calculator" description="Quickly calculate MRR, ARR, and the revenue retained after monthly churn. Use it for a fast baseline, then track changes over time." points={["Enter current recurring revenue, not total sales.", "Use a consistent churn definition month to month.", "Watch the direction over time, not a single snapshot."]}><SaaSMetricsTool /></ToolLanding>; }
