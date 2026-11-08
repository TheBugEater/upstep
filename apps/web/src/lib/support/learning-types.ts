import { z } from "zod";
export const learningSchema = z.object({
  businessName: z.string().trim().min(1).max(80),
  logoUrl: z.string().max(180000).nullable().optional(),
  summary: z.string().trim().min(1).max(3000),
  supportEmail: z.string().email().max(254).nullable(),
  suggestedInstructions: z.string().trim().min(1).max(1800),
  facts: z
    .array(
      z.object({
        label: z.string().max(80),
        value: z.string().max(500),
        sources: z.array(z.string().url()).max(3),
      }),
    )
    .max(6),
  questions: z
    .array(
      z.object({
        id: z.string().max(30),
        question: z.string().max(250),
        suggestion: z.string().max(500),
        inputType: z.enum(["choice", "text"]).optional(),
        options: z.array(z.string().trim().min(1).max(160)).max(4).optional(),
      }),
    )
    .max(3),
});
export type BusinessLearning = z.infer<typeof learningSchema>;
export type BusinessLearningInput = {
  domain: string;
  sources: { url: string; title: string; content: string }[];
};
export const learningJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    businessName: { type: "string" },
    summary: { type: "string" },
    supportEmail: { type: ["string", "null"] },
    suggestedInstructions: { type: "string" },
    facts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string" },
          value: { type: "string" },
          sources: { type: "array", items: { type: "string" } },
        },
        required: ["label", "value", "sources"],
      },
    },
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          question: { type: "string" },
          suggestion: { type: "string" },
          inputType: { type: "string", enum: ["choice", "text"] },
          options: { type: "array", items: { type: "string" } },
        },
        required: ["id", "question", "suggestion", "inputType", "options"],
      },
    },
  },
  required: [
    "businessName",
    "summary",
    "supportEmail",
    "suggestedInstructions",
    "facts",
    "questions",
  ],
};
