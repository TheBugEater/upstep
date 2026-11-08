import type {
  SupportConfiguration,
  SupportConversation,
  UpstepConfig,
} from "@upstep/types";
export interface SupportStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
export class SupportApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export function supportMessageId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 3) | 8).toString(16);
  });
}
/** Portable chat client. No DOM, WebView or browser globals are required. */
export class SupportClient {
  private token: string | null = null;
  private session: Promise<void> | null = null;
  private identityToken: string | undefined;
  private epoch = 0;
  private readonly baseUrl: string;
  private readonly key: string;
  private readonly storageKey: string;
  constructor(
    config: Pick<UpstepConfig, "apiKey" | "baseUrl" | "supportIdentityToken">,
    private storage?: SupportStorage,
    private transport: typeof fetch = fetch,
  ) {
    this.baseUrl = (config.baseUrl || "https://upstep.dev").replace(/\/$/, "");
    this.key = config.apiKey;
    this.identityToken = config.supportIdentityToken;
    this.storageKey = `upstep:support:${this.baseUrl}:${this.key}`;
  }
  async identify(token: string | undefined) {
    if (token === this.identityToken) return;
    this.epoch++;
    this.identityToken = token;
    this.token = null;
    this.session = null;
    await this.storage?.removeItem(this.storageKey).catch(() => {});
  }
  private async request<T>(path: string, body?: unknown): Promise<T> {
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), 20000);
    try {
      const r = await this.transport(`${this.baseUrl}/api/sdk/support${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.key,
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        credentials: "omit",
        redirect: "error",
        signal: timeout.signal,
      });
      const data = await r.json();
      if (!r.ok) {
        if (r.status === 401 && path) {
          this.token = null;
          await this.storage?.removeItem(this.storageKey).catch(() => {});
        }
        throw new SupportApiError(
          typeof data.error === "string"
            ? data.error
            : "Could not connect to support.",
          r.status,
        );
      }
      return data as T;
    } finally {
      clearTimeout(timer);
    }
  }
  async configuration(): Promise<SupportConfiguration | null> {
    try {
      return await this.request<SupportConfiguration>("");
    } catch (error) {
      if (error instanceof SupportApiError && [402, 404].includes(error.status))
        return null;
      throw error;
    }
  }
  private async ensureSession() {
    if (this.token) return;
    if (!this.session) {
      const epoch = this.epoch;
      const identity = this.identityToken;
      const session = (async () => {
        if (!identity) {
          try {
            const saved = await this.storage?.getItem(this.storageKey);
            if (saved && epoch === this.epoch) {
              this.token = saved;
              return;
            }
          } catch {
            /* memory-only sessions still work */
          }
        }
        if (epoch !== this.epoch) throw new Error("Customer identity changed.");
        const result = await this.request<{ token: string }>(
          "",
          identity ? { identityToken: identity } : {},
        );
        if (epoch !== this.epoch) throw new Error("Customer identity changed.");
        this.token = result.token;
        if (!identity)
          await this.storage
            ?.setItem(this.storageKey, result.token)
            .catch(() => {});
      })();
      this.session = session;
      void session
        .finally(() => {
          if (this.session === session) this.session = null;
        })
        .catch(() => {});
    }
    await this.session;
  }
  async conversations() {
    await this.ensureSession();
    return (
      await this.request<{ conversations: { id: string; state: string }[] }>(
        "/conversations",
      )
    ).conversations;
  }
  async startConversation() {
    await this.ensureSession();
    return this.request<{ id: string; state: string }>("/conversations", {});
  }
  async conversation(id: string) {
    await this.ensureSession();
    return this.request<SupportConversation>(
      `/conversations/${encodeURIComponent(id)}`,
    );
  }
  async send(
    id: string,
    content: string,
    clientMessageId = supportMessageId(),
  ) {
    await this.ensureSession();
    await this.request(`/conversations/${encodeURIComponent(id)}`, {
      action: "message",
      content,
      clientMessageId,
    });
  }
  async details(
    id: string,
    values: {
      widgetId: string;
      summary: string;
      details?: string;
      reference?: string;
      clientMessageId?: string;
    },
  ) {
    await this.ensureSession();
    await this.request(`/conversations/${encodeURIComponent(id)}`, {
      action: "details",
      ...values,
      clientMessageId: values.clientMessageId || supportMessageId(),
    });
  }
  async handoff(id: string, name: string, email: string) {
    await this.ensureSession();
    await this.request(`/conversations/${encodeURIComponent(id)}`, {
      action: "handoff",
      name,
      email,
    });
  }
}
