export type Tool = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
};

export const TOOLS: Record<string, Tool> = {
  "rice-calculator": {
    slug: "rice-calculator",
    name: "RICE Score Calculator",
    tagline: "Prioritize your backlog in minutes",
    description:
      "Score features by Reach, Impact, Confidence, and Effort to see what to build next. Free, no signup, nothing leaves your browser.",
  },
  "feedback-widget-generator": {
    slug: "feedback-widget-generator",
    name: "Feedback Widget Generator",
    tagline: "A copy-paste feedback button for any site",
    description:
      "Generate a lightweight floating feedback button in seconds. No account, no backend, just a script tag you paste into your site.",
  },
};
