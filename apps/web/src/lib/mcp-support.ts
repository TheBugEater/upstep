import { z } from "zod";
import { listSupportConnectors, saveSupportConnector } from "./support/connector-management";
import { CONNECTOR_LIMITS, connectorActionSchema, connectorInputSchema, type connectorView } from "./support/connectors";
import { getSupportKnowledge, queueKnowledgeRefresh } from "./support/knowledge-management";
import { beginBusinessLearning, confirmBusinessLearning, reviewSchema } from "./support/learning";
import { SupportError } from "./support/policy";
import { supportProject } from "./support/service";

const noArgs = z.strictObject({});

function supportTool<T extends z.ZodType>(
  name: string,
  description: string,
  schema: T,
  run: (projectId: string, args: z.output<T>, scheduleJobs: () => void) => Promise<unknown>,
) {
  const { $schema, ...inputSchema } = z.toJSONSchema(schema, { io: "input" });
  return {
    definition: { name, description, inputSchema },
    run(projectId: string, input: unknown, scheduleJobs: () => void) {
      const parsed = schema.safeParse(input);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const path = issue?.path.join(".");
        throw new SupportError(`Invalid arguments${path ? ` at ${path}` : ""}: ${issue?.message || "Check the tool schema."}`);
      }
      return run(projectId, parsed.data, scheduleJobs);
    },
  };
}

function connectorSummary({ secretHint: _hint, ...connector }: ReturnType<typeof connectorView>) {
  return connector;
}

const tools = [
  supportTool(
    "get_support_knowledge",
    "Read support settings, website indexing status, indexed page metadata, confirmed facts and answers, and website learning findings. Poll after starting learning until learningState is REVIEW or FAILED, then use the current generation to save the review. Findings are suggestions to verify against the project's own sources.",
    noArgs,
    (projectId) => getSupportKnowledge(projectId),
  ),
  supportTool(
    "learn_support_website",
    "Start or retry learning from the project's public business website. Returns the queued generation. Changing the domain replaces the previous website setup and disables live support until confirmed. Use refresh_support_knowledge to reindex an existing website without a new review.",
    z.strictObject({ domain: z.string().trim().min(3).max(253) }),
    async (projectId, { domain }, scheduleJobs) => {
      const config = await beginBusinessLearning(projectId, domain);
      scheduleJobs();
      return { domain: config.domain, generation: config.crawlGeneration, learningState: config.learningState };
    },
  ),
  supportTool(
    "save_support_knowledge",
    "Confirm or edit the support profile using the current generation from get_support_knowledge. Supply verified business details and answers keyed by the current question IDs. This replaces the saved facts and answers. Set enabled to true to make support live or false to save it disabled.",
    reviewSchema.extend({ enabled: z.boolean() }).strict(),
    async (projectId, review, scheduleJobs) => {
      await confirmBusinessLearning(projectId, review);
      scheduleJobs();
      return { saved: true, generation: review.generation, learningState: "READY", enabled: review.enabled };
    },
  ),
  supportTool(
    "refresh_support_knowledge",
    "Queue a fresh index of the current website for an enabled support setup. Keeps confirmed business details and connectors. Poll get_support_knowledge for the crawl state.",
    noArgs,
    async (projectId, _args, scheduleJobs) => {
      const result = await queueKnowledgeRefresh(projectId);
      scheduleJobs();
      return result;
    },
  ),
  supportTool(
    "list_support_connectors",
    "List the project's support connectors and their read-only actions. Shows whether a credential is configured, without returning it. Use the connector id for edits or renames.",
    noArgs,
    async (projectId) => {
      await supportProject(projectId);
      const connectors = await listSupportConnectors(projectId);
      return { connectors: connectors.map(connectorSummary), limits: CONNECTOR_LIMITS };
    },
  ),
  supportTool(
    "save_support_connector",
    "Create or replace a support connector. With an id, update that connector. Without an id, match by name (case-insensitive) or create it. Send the complete list of HTTPS GET actions. CUSTOMER actions require {customer_id} or {customer_email}, filled by Upstep from the verified customer identity. PUBLIC actions must expose only public data. Omit secret to retain existing authentication for the same URL and auth settings.",
    z.strictObject({
      id: z.string().min(1).max(100).optional(),
      connector: connectorInputSchema.extend({
        actions: z.array(connectorActionSchema.strict()).max(CONNECTOR_LIMITS.actions),
        secret: connectorInputSchema.shape.secret.describe("Credential from an authorized secret source. Omit to keep the saved credential when URL and auth settings are unchanged."),
      }).strict(),
    }),
    async (projectId, { id, connector }) => {
      await supportProject(projectId);
      const saved = await saveSupportConnector(projectId, connector, { ...(id && { id }), upsertByName: true });
      return { created: saved.created, connector: connectorSummary(saved.connector) };
    },
  ),
];

export const supportMcpToolDefinitions = tools.map(({ definition }) => definition);
export const supportMcpTools = new Map(tools.map(({ definition, run }) => [definition.name, run]));
