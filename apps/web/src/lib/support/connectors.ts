import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import ipaddr from "ipaddr.js";
import { z } from "zod";
import { isPublicAddress } from "./crawler";
import { SupportError } from "./policy";

// Connectors let the support AI read live data about the verified customer it
// is talking to (orders, plans, bookings). They are deliberately narrow:
// HTTPS GET only, public addresses only, customer parameters filled from the
// signed-in identity (never from chat text), sensitive fields removed before
// the model sees a response, and the credential encrypted at rest.

export const CONNECTOR_LIMITS = {
  connectors: 10,
  actions: 10,
  lookupsPerReply: 3,
  responseBytes: 256_000,
  dataChars: 4000,
  timeoutMs: 6000,
} as const;
export const CONNECTOR_AUTH_TYPES = ["NONE", "BEARER", "HEADER"] as const;
export const IDENTITY_PARAMS = ["customer_id", "customer_email"] as const;
type IdentityParam = (typeof IDENTITY_PARAMS)[number];

const PLACEHOLDER = /\{([a-z][a-z0-9_]*)\}/g;
const placeholders = (path: string) =>
  [...path.matchAll(PLACEHOLDER)].map((m) => m[1]!);
const isIdentity = (name: string): name is IdentityParam =>
  (IDENTITY_PARAMS as readonly string[]).includes(name);

export const connectorActionSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),
    name: z
      .string()
      .trim()
      .regex(
        /^[a-z][a-z0-9_]{1,47}$/,
        "Action names use lowercase letters, numbers and underscores.",
      ),
    description: z
      .string()
      .trim()
      .min(10, "Describe when the AI should use each action.")
      .max(500),
    path: z.string().trim().min(1).max(500),
    scope: z.enum(["CUSTOMER", "PUBLIC"]),
    enabled: z.boolean(),
    inputs: z
      .array(
        z.object({
          name: z
            .string()
            .trim()
            .regex(/^[a-z][a-z0-9_]{0,31}$/, "Input names use lowercase letters."),
          description: z.string().trim().max(200),
        }),
      )
      .max(3),
    hiddenFields: z.array(z.string().trim().min(1).max(80)).max(40),
  })
  .superRefine((action, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: "custom", message: `${action.name}: ${message}` });
    const { path } = action;
    if (!path.startsWith("/") || path.startsWith("//"))
      issue("the path must start with a single /.");
    if (/[#\\\s]/.test(path) || /(^|\/)\.\.?(\/|$|\?)/.test(path))
      issue("the path can't contain spaces, #, backslashes or dot segments.");
    if (path.replace(PLACEHOLDER, "").match(/[{}]/))
      issue("placeholders look like {customer_id}.");
    const used = placeholders(path);
    const declared = new Set(action.inputs.map((i) => i.name));
    for (const name of declared) {
      if (isIdentity(name))
        issue(`{${name}} is filled from the signed-in customer, not an input.`);
      if (!used.includes(name)) issue(`input "${name}" isn't used in the path.`);
    }
    for (const name of used)
      if (!isIdentity(name) && !declared.has(name))
        issue(`{${name}} needs a matching input.`);
    const identity = used.some(isIdentity);
    if (action.scope === "CUSTOMER" && !identity)
      issue(
        "customer actions must include {customer_id} or {customer_email} so they only return the signed-in customer's data.",
      );
    if (action.scope === "PUBLIC" && identity)
      issue("public actions can't use customer identity placeholders.");
  });
export type ConnectorAction = z.infer<typeof connectorActionSchema>;

const FORBIDDEN_HEADERS = new Set([
  "host",
  "content-length",
  "content-type",
  "connection",
  "cookie",
  "transfer-encoding",
  "accept",
  "accept-encoding",
  "user-agent",
]);
export const connectorInputSchema = z.object({
  name: z.string().trim().min(1, "Name the connector.").max(60),
  baseUrl: z.string().trim().min(1).max(300),
  authType: z.enum(CONNECTOR_AUTH_TYPES),
  authHeader: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{1,64}$/, "Use a plain header name like X-Api-Key.")
    .refine((h) => !FORBIDDEN_HEADERS.has(h.toLowerCase()), "That header can't be used for authentication.")
    .nullable()
    .optional(),
  // undefined keeps the stored secret, "" removes it.
  secret: z.string().max(4096).optional(),
  enabled: z.boolean(),
  actions: z.array(connectorActionSchema).max(CONNECTOR_LIMITS.actions),
});
export type ConnectorInput = z.infer<typeof connectorInputSchema>;

export function normalizeBaseUrl(input: string) {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new SupportError("Enter the API's base URL, like https://api.example.com/v1.");
  }
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    url.search ||
    url.hash ||
    !host.includes(".") ||
    ipaddr.isValid(host.replace(/^\[|\]$/g, "")) ||
    /(^|\.)(localhost|local|internal|localdomain|home\.arpa)$/.test(host)
  )
    throw new SupportError(
      "Use a public HTTPS API address without a port, query string or credentials.",
    );
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

// ─── Secrets ────────────────────────────────────────────────────────────────
function connectorKey() {
  const root = process.env.SUPPORT_CONNECTOR_SECRET || process.env.AUTH_SECRET;
  if (!root)
    throw new SupportError("Connector encryption is not configured.", 503);
  return createHash("sha256")
    .update(`upstep:support:connector:v1:${root}`)
    .digest();
}
// The project id is bound as associated data so a ciphertext copied to another
// project's row fails to decrypt.
export function sealSecret(plain: string, projectId: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", connectorKey(), iv);
  cipher.setAAD(Buffer.from(projectId));
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    body.toString("base64url"),
  ].join(".");
}
export function openSecret(sealed: string, projectId: string) {
  const [version, iv, tag, body] = sealed.split(".");
  if (version !== "v1" || !iv || !tag || !body)
    throw new Error("Unsupported connector secret");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    connectorKey(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAAD(Buffer.from(projectId));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(body, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
export const secretHint = (secret: string) =>
  secret.length >= 12 ? secret.slice(-4) : null;

// ─── Requests ───────────────────────────────────────────────────────────────
export type ConnectorIdentity = {
  externalId: string | null;
  email: string | null;
  verified: boolean;
};
function identityValue(name: IdentityParam, identity: ConnectorIdentity) {
  if (!identity.verified) return null;
  return name === "customer_id" ? identity.externalId : identity.email;
}
// Actions the AI may use for this customer. Customer actions disappear for
// guests, so the model never sees a lookup it isn't allowed to make.
export function usableActions(
  actions: ConnectorAction[],
  identity: ConnectorIdentity,
) {
  return actions.filter(
    (a) =>
      a.enabled &&
      placeholders(a.path)
        .filter(isIdentity)
        .every((p) => !!identityValue(p, identity)),
  );
}
const INPUT_VALUE = /^[\p{L}\p{N}_.@+\-:# ]{1,120}$/u;
export function buildActionUrl(
  baseUrl: string,
  action: ConnectorAction,
  identity: ConnectorIdentity,
  inputs: Record<string, string> = {},
) {
  const path = action.path.replace(PLACEHOLDER, (_, name: string) => {
    const value = isIdentity(name)
      ? identityValue(name, identity)
      : inputs[name]?.trim();
    if (!value)
      throw new SupportError(
        isIdentity(name)
          ? "This lookup needs a signed-in customer."
          : `Missing value for ${name}.`,
      );
    if (!isIdentity(name) && !INPUT_VALUE.test(value))
      throw new SupportError(`The value for ${name} isn't allowed.`);
    return encodeURIComponent(value);
  });
  const base = new URL(baseUrl);
  const url = new URL(`${base.pathname.replace(/\/+$/, "")}${path}`, base.origin);
  if (
    url.origin !== base.origin ||
    !`${url.pathname}/`.startsWith(`${base.pathname.replace(/\/+$/, "")}/`)
  )
    throw new SupportError("The action path leaves the connector's base URL.");
  return url;
}

const SENSITIVE_KEY =
  /pass(word)?|secret|token|api[_-]?key|authorization|cookie|session|ssn|social[_-]?security|card[_-]?number|cvv|cvc|iban|routing|account[_-]?number|^pin$/i;
export function redactFields(value: unknown, hidden: string[]) {
  const rules = new Set(hidden.map((h) => h.toLowerCase()));
  const walk = (v: unknown, path: string, depth: number): unknown => {
    if (depth > 6) return "[truncated]";
    if (typeof v === "string") return v.length > 500 ? `${v.slice(0, 500)}…` : v;
    if (Array.isArray(v)) return v.slice(0, 20).map((x) => walk(x, path, depth + 1));
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(v).slice(0, 60)) {
        const full = path ? `${path}.${key}` : key;
        out[key] =
          SENSITIVE_KEY.test(key) ||
          rules.has(key.toLowerCase()) ||
          rules.has(full.toLowerCase())
            ? "[removed]"
            : walk(child, full, depth + 1);
      }
      return out;
    }
    return v;
  };
  return walk(value, "", 0);
}

export type ConnectorResponse = { status: number; data: unknown };
export type ConnectorFetcher = (
  url: URL,
  headers: Record<string, string>,
) => Promise<ConnectorResponse>;

// Pin a public DNS answer for the request; never follow redirects.
export const fetchConnectorJson: ConnectorFetcher = async (url, headers) => {
  const answers = await Promise.race([
    lookup(url.hostname, { all: true }),
    new Promise<never>((_, reject) => {
      const t = setTimeout(() => reject(new Error("DNS timeout")), 3000);
      t.unref();
    }),
  ]);
  if (!answers.length || answers.some((a) => !isPublicAddress(a.address)))
    throw new Error("The API must resolve to public addresses");
  const answer = answers[0]!;
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: "GET",
        headers: {
          ...headers,
          Accept: "application/json",
          "Accept-Encoding": "identity",
          "User-Agent": "UpStepConnector/1.0 (+https://upstep.dev)",
        },
        lookup: (_host, options, callback) => {
          if (options.all) callback(null, [answer]);
          else callback(null, answer.address, answer.family);
        },
      },
      (response) => {
        const status = response.statusCode || 500;
        if (status >= 300 && status < 400) {
          req.destroy();
          return reject(new Error("The API redirected; redirects are not followed"));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > CONNECTOR_LIMITS.responseBytes)
            req.destroy(new Error("The API response is too large"));
          else chunks.push(chunk);
        });
        response.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          const type = String(response.headers["content-type"] || "");
          let data: unknown = null;
          if (text && /json/i.test(type)) {
            try {
              data = JSON.parse(text);
            } catch {
              return reject(new Error("The API returned invalid JSON"));
            }
          } else if (status < 400 && text)
            return reject(new Error("The API didn't return JSON"));
          resolve({ status, data });
        });
        response.on("error", reject);
      },
    );
    const timer = setTimeout(
      () => req.destroy(new Error("The API timed out")),
      CONNECTOR_LIMITS.timeoutMs,
    );
    req.once("close", () => clearTimeout(timer));
    req.on("error", reject);
    req.end();
  });
};

export type StoredConnector = {
  id: string;
  projectId: string;
  name: string;
  baseUrl: string;
  authType: string;
  authHeader: string | null;
  secretCipher: string | null;
  actions: unknown;
};
export function connectorActions(value: unknown): ConnectorAction[] {
  const parsed = z.array(z.unknown()).safeParse(value);
  if (!parsed.success) return [];
  return parsed.data.flatMap((a) => {
    const action = connectorActionSchema.safeParse(a);
    return action.success ? [action.data] : [];
  });
}
function authHeaders(connector: StoredConnector): Record<string, string> {
  if (connector.authType === "NONE" || !connector.secretCipher) return {};
  const secret = openSecret(connector.secretCipher, connector.projectId);
  if (connector.authType === "BEARER") return { Authorization: `Bearer ${secret}` };
  if (connector.authType === "HEADER" && connector.authHeader)
    return { [connector.authHeader]: secret };
  return {};
}

export type LookupResult = {
  connector: string;
  action: string;
  ok: boolean;
  status: number | null;
  ms: number;
  data?: string;
  error?: string;
};
export async function runConnectorAction(
  connector: StoredConnector,
  action: ConnectorAction,
  identity: ConnectorIdentity,
  inputs: Record<string, string> = {},
  fetcher: ConnectorFetcher = fetchConnectorJson,
): Promise<LookupResult> {
  const started = Date.now();
  const base = { connector: connector.name, action: action.name };
  try {
    const url = buildActionUrl(connector.baseUrl, action, identity, inputs);
    const response = await fetcher(url, authHeaders(connector));
    const ms = Date.now() - started;
    if (response.status === 404)
      return { ...base, ok: true, status: 404, ms, data: "No matching record found." };
    if (response.status >= 400)
      return { ...base, ok: false, status: response.status, ms, error: `The API answered HTTP ${response.status}.` };
    const json = JSON.stringify(redactFields(response.data, action.hiddenFields));
    return {
      ...base,
      ok: true,
      status: response.status,
      ms,
      data:
        json.length > CONNECTOR_LIMITS.dataChars
          ? `${json.slice(0, CONNECTOR_LIMITS.dataChars)}…[truncated]`
          : json,
    };
  } catch (error) {
    return {
      ...base,
      ok: false,
      status: null,
      ms: Date.now() - started,
      // Our own messages are safe to show; network errors may contain hosts or
      // internals, so they collapse to a generic reason.
      error:
        error instanceof SupportError || (error instanceof Error && /^The API/.test(error.message))
          ? error.message
          : "The lookup failed.",
    };
  }
}

export type LookupTool = {
  key: string;
  connector: StoredConnector;
  action: ConnectorAction;
};
export function lookupTools(
  connectors: StoredConnector[],
  identity: ConnectorIdentity,
): LookupTool[] {
  return connectors
    .flatMap((connector) =>
      usableActions(connectorActions(connector.actions), identity).map(
        (action) => ({ connector, action }),
      ),
    )
    .slice(0, 30)
    .map((t, i) => ({ key: `t${i + 1}`, ...t }));
}
export async function executeLookups(
  calls: { tool: string; inputs: { name: string; value: string }[] }[],
  tools: LookupTool[],
  identity: ConnectorIdentity,
  fetcher?: ConnectorFetcher,
) {
  const seen = new Set<string>();
  const chosen = calls
    .filter((call) => {
      const id = `${call.tool}:${JSON.stringify(call.inputs)}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, CONNECTOR_LIMITS.lookupsPerReply)
    .flatMap((call) => {
      const tool = tools.find((t) => t.key === call.tool);
      if (!tool) return [];
      const allowed = new Set(tool.action.inputs.map((i) => i.name));
      const inputs = Object.fromEntries(
        call.inputs
          .filter((i) => allowed.has(i.name))
          .map((i) => [i.name, i.value]),
      );
      return [{ tool, inputs }];
    });
  return Promise.all(
    chosen.map(({ tool, inputs }) =>
      runConnectorAction(tool.connector, tool.action, identity, inputs, fetcher),
    ),
  );
}

// What the dashboard may see about a connector: never the secret.
export function connectorView(c: StoredConnector & {
  enabled: boolean;
  secretHint: string | null;
  updatedAt: Date;
}) {
  return {
    id: c.id,
    name: c.name,
    baseUrl: c.baseUrl,
    authType: c.authType,
    authHeader: c.authHeader,
    hasSecret: !!c.secretCipher,
    secretHint: c.secretHint,
    enabled: c.enabled,
    actions: connectorActions(c.actions),
    updatedAt: c.updatedAt,
  };
}

// Turn a validated dashboard payload into the stored row. `existingSecret`
// keeps the saved credential when the form leaves the secret blank.
export function connectorData(
  projectId: string,
  input: ConnectorInput,
  existing?: { secretCipher: string | null; secretHint: string | null },
) {
  const names = new Set<string>();
  const ids = new Set<string>();
  for (const a of input.actions) {
    if (names.has(a.name)) throw new SupportError(`Two actions are named ${a.name}.`);
    if (ids.has(a.id)) throw new SupportError("Action ids must be unique.");
    names.add(a.name);
    ids.add(a.id);
  }
  if (input.authType === "HEADER" && !input.authHeader)
    throw new SupportError("Enter the header name the API expects, like X-Api-Key.");
  const secret = input.secret?.trim();
  const keep = input.secret === undefined && input.authType !== "NONE";
  const secretCipher =
    input.authType === "NONE"
      ? null
      : secret
        ? sealSecret(secret, projectId)
        : keep
          ? (existing?.secretCipher ?? null)
          : null;
  if (input.authType !== "NONE" && !secretCipher)
    throw new SupportError("Add the API token so the connector can authenticate.");
  return {
    name: input.name,
    baseUrl: normalizeBaseUrl(input.baseUrl),
    authType: input.authType,
    authHeader: input.authType === "HEADER" ? input.authHeader! : null,
    secretCipher,
    secretHint:
      input.authType === "NONE"
        ? null
        : secret
          ? secretHint(secret)
          : (existing?.secretHint ?? null),
    enabled: input.enabled,
    actions: input.actions,
  };
}
export function parseConnectorInput(value: unknown) {
  const parsed = connectorInputSchema.safeParse(value);
  if (!parsed.success)
    throw new SupportError(
      parsed.error.issues[0]?.message || "Check the connector settings.",
    );
  return parsed.data;
}
