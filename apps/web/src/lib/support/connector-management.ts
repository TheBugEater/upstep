import { db } from "../db";
import { collaborationTransaction } from "../project-collaboration";
import {
  CONNECTOR_LIMITS,
  connectorData,
  connectorView,
  normalizeBaseUrl,
  type ConnectorInput,
} from "./connectors";
import { SupportError } from "./policy";

export async function listSupportConnectors(projectId: string) {
  const connectors = await db.supportConnector.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });
  return connectors.map(connectorView);
}

export async function saveSupportConnector(
  projectId: string,
  input: ConnectorInput,
  { id, upsertByName = false }: { id?: string; upsertByName?: boolean } = {},
) {
  return collaborationTransaction(async (tx) => {
    const matches = await tx.supportConnector.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });
    const named = upsertByName && !id
      ? matches.filter((connector) => connector.name.toLowerCase() === input.name.toLowerCase())
      : [];
    if (named.length > 1)
      throw new SupportError("More than one connector has this name. Specify its id.", 409);
    const existing = id ? matches.find((connector) => connector.id === id) : named[0];
    if (id && !existing) throw new SupportError("Connector not found.", 404);
    if (!existing && matches.length >= CONNECTOR_LIMITS.connectors)
      throw new SupportError(`A project can have up to ${CONNECTOR_LIMITS.connectors} connectors.`);

    // Automation can reuse a stored token only with the same destination and auth settings.
    if (
      upsertByName && existing?.secretCipher && input.secret === undefined &&
      input.authType !== "NONE" &&
      (existing.baseUrl !== normalizeBaseUrl(input.baseUrl) ||
        existing.authType !== input.authType ||
        existing.authHeader?.toLowerCase() !== input.authHeader?.toLowerCase())
    ) throw new SupportError("Supply a credential when changing the connector URL or authentication settings.");

    const data = connectorData(projectId, input, existing);
    const connector = existing
      ? await tx.supportConnector.update({ where: { id: existing.id }, data })
      : await tx.supportConnector.create({ data: { projectId, ...data } });
    return { created: !existing, connector: connectorView(connector) };
  });
}
