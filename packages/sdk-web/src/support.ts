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
/** What a customer has not read yet in their latest conversation. */
export interface SupportUnreadSummary {
  count: number;
  chatId: string | null;
  latest?: { author: string; role: string; preview: string };
}
type SeenRecord = { chat: string; id: string };
/** Incoming AI or team messages after the given message. System notes and the customer's own messages never count. */
export function unreadSupportMessages<T extends { id: string; role: string }>(
  messages: T[],
  seenId: string | null,
): T[] {
  if (seenId === null) return [];
  const readable = messages.filter((m) => m.role !== "SYSTEM");
  const index = readable.findIndex((m) => m.id === seenId);
  if (index < 0) return [];
  return readable.slice(index + 1).filter((m) => m.role !== "CUSTOMER");
}
export function supportPreview(text: string, max = 120) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
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
  private readonly seenKey: string;
  private readonly soundKey: string;
  constructor(
    config: Pick<UpstepConfig, "apiKey" | "baseUrl" | "supportIdentityToken">,
    private storage?: SupportStorage,
    private transport: typeof fetch = fetch,
  ) {
    this.baseUrl = (config.baseUrl || "https://upstep.dev").replace(/\/$/, "");
    this.key = config.apiKey;
    this.identityToken = config.supportIdentityToken;
    this.storageKey = `upstep:support:${this.baseUrl}:${this.key}`;
    this.seenKey = `upstep:support-seen:${this.baseUrl}:${this.key}`;
    this.soundKey = `upstep:support-sound:${this.baseUrl}:${this.key}`;
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
  /** True when this customer already has a support session, so checking for replies creates nothing new. */
  async hasSession() {
    if (this.token || this.identityToken) return true;
    try {
      return !!(await this.storage?.getItem(this.storageKey));
    } catch {
      return false;
    }
  }
  /** The last message the customer has read in a conversation, if one was recorded. */
  async seenId(chatId: string): Promise<string | null> {
    try {
      const saved: SeenRecord | null = JSON.parse(
        (await this.storage?.getItem(this.seenKey)) || "null",
      );
      return saved?.chat === chatId ? saved.id : null;
    } catch {
      return null;
    }
  }
  /** Record that the customer has read everything in this conversation. */
  async markSeen(conversation: SupportConversation) {
    const last = conversation.messages
      .filter((m) => m.role !== "SYSTEM")
      .at(-1);
    if (!last) return;
    const record: SeenRecord = { chat: conversation.id, id: last.id };
    await this.storage
      ?.setItem(this.seenKey, JSON.stringify(record))
      .catch(() => {});
  }
  /**
   * Unread AI or team messages in the latest conversation. A conversation with
   * no saved record counts as read, so returning customers never see a stale count.
   */
  async unread(): Promise<SupportUnreadSummary> {
    const none = { count: 0, chatId: null };
    if (!(await this.hasSession())) return none;
    const first = (await this.conversations())[0];
    if (!first) return none;
    const chat = await this.conversation(first.id);
    const last = chat.messages.filter((m) => m.role !== "SYSTEM").at(-1);
    if (!last) return { count: 0, chatId: chat.id };
    let saved: SeenRecord | null = null;
    try {
      saved = JSON.parse((await this.storage?.getItem(this.seenKey)) || "null");
    } catch {
      saved = null;
    }
    if (saved?.chat !== chat.id) {
      await this.markSeen(chat);
      return { count: 0, chatId: chat.id };
    }
    const unread = unreadSupportMessages(chat.messages, saved.id);
    const latest = unread.at(-1);
    return {
      count: unread.length,
      chatId: chat.id,
      ...(latest
        ? {
            latest: {
              author: latest.role === "ASSISTANT" ? "AI" : latest.authorName,
              role: latest.role,
              preview: supportPreview(latest.content),
            },
          }
        : {}),
    };
  }
  async soundEnabled() {
    try {
      return (await this.storage?.getItem(this.soundKey)) !== "off";
    } catch {
      return true;
    }
  }
  async setSoundEnabled(enabled: boolean) {
    await this.storage
      ?.setItem(this.soundKey, enabled ? "on" : "off")
      .catch(() => {});
  }
}
