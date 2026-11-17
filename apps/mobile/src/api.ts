export type Tokens = {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
};
export type TokenStore = {
  get(): Promise<string | null>;
  set(value: string): Promise<void>;
  clear(): Promise<void>;
};
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function normalizeServerUrl(value: string, allowHttp = false): string {
  const input = value.trim();
  if (!input) throw new Error("Enter your Upstep server address.");
  let url: URL;
  try {
    url = new URL(input.includes("://") ? input : `https://${input}`);
  } catch {
    throw new Error(
      "Enter a valid server address, such as https://upstep.dev.",
    );
  }
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (url.protocol !== "https:" && !(allowHttp && url.protocol === "http:"))
  )
    throw new Error(
      "Use an HTTPS server address without a path, password or query string.",
    );
  return url.origin;
}

export function parseNotificationTarget(
  data: Record<string, unknown> | undefined,
  server: string,
) {
  if (
    !data ||
    data.serverUrl !== server ||
    typeof data.projectId !== "string" ||
    typeof data.conversationId !== "string" ||
    !data.projectId ||
    !data.conversationId ||
    data.projectId.length > 128 ||
    data.conversationId.length > 128
  )
    return null;
  return { projectId: data.projectId, conversationId: data.conversationId };
}

// Transport and secure storage are injected so token rotation/retries can be tested without a phone.
export class MobileApi {
  private tokens: Tokens | null = null;
  private refreshing: Promise<void> | null = null;
  private generation = 0;
  onSignedOut: (() => void) | undefined;
  constructor(
    private base: string,
    private store: TokenStore,
    private transport: typeof fetch = fetch,
  ) {}
  get baseUrl() {
    return this.base;
  }
  get hasSession() {
    return this.tokens !== null;
  }
  configureServer(origin: string) {
    if (this.tokens || this.refreshing)
      throw new ApiError("Sign out before changing servers.", 409);
    this.base = origin;
    this.generation++;
  }
  private assertGeneration(generation: number) {
    if (generation !== this.generation)
      throw new ApiError(
        "The server or sign-in changed. Please try again.",
        409,
      );
  }
  async restore() {
    const raw = await this.store.get();
    if (!raw) return false;
    try {
      const value = JSON.parse(raw) as Tokens & { origin: string };
      if (
        value.origin !== this.base ||
        !value.accessToken ||
        !value.refreshToken ||
        !Number.isFinite(Date.parse(value.accessExpiresAt))
      )
        throw new Error();
      this.tokens = value;
      return true;
    } catch {
      await this.clear();
      return false;
    }
  }
  async clear() {
    this.generation++;
    this.tokens = null;
    await this.store.clear();
    this.onSignedOut?.();
  }
  private async save(tokens: Tokens, generation: number) {
    this.assertGeneration(generation);
    await this.store.set(JSON.stringify({ ...tokens, origin: this.base }));
    this.assertGeneration(generation);
    this.tokens = tokens;
  }
  private async tokenRequest(body: unknown) {
    const response = await this.transport(`${this.base}/api/mobile/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
      redirect: "error",
      credentials: "omit",
    });
    const data = await response.json();
    if (!response.ok)
      throw new ApiError(data.error || "Could not sign in.", response.status);
    return data as Tokens;
  }
  async signIn(code: string, verifier: string) {
    const generation = this.generation;
    await this.save(
      await this.tokenRequest({ grantType: "code", code, verifier }),
      generation,
    );
  }
  async checkServer() {
    const response = await this.transport(`${this.base}/api/mobile/info`, {
      signal: AbortSignal.timeout(15_000),
      redirect: "error",
      credentials: "omit",
    });
    const info = await response.json().catch(() => null);
    if (
      !response.ok ||
      info?.product !== "upstep" ||
      info.mobileApiVersion !== 1
    )
      throw new ApiError(
        "This server needs the Upstep mobile support update before you can sign in.",
        response.status || 400,
      );
  }
  private refresh() {
    if (!this.refreshing)
      this.refreshing = (async () => {
        if (!this.tokens) throw new ApiError("Please sign in.", 401);
        const generation = this.generation;
        try {
          await this.save(
            await this.tokenRequest({
              grantType: "refresh",
              refreshToken: this.tokens.refreshToken,
            }),
            generation,
          );
        } catch (error) {
          if (
            generation === this.generation &&
            error instanceof ApiError &&
            error.status === 401
          )
            await this.clear();
          throw error;
        }
      })().finally(() => {
        this.refreshing = null;
      });
    return this.refreshing;
  }
  async request<T = { saved: boolean }>(
    path: string,
    method = "GET",
    body?: unknown,
  ): Promise<T> {
    if (!path.startsWith("/api/")) throw new Error("Invalid API path");
    if (!this.tokens) throw new ApiError("Please sign in.", 401);
    const generation = this.generation;
    const server = this.base;
    if (Date.parse(this.tokens.accessExpiresAt) - Date.now() < 30_000)
      await this.refresh();
    this.assertGeneration(generation);
    const used = this.tokens?.accessToken;
    const send = () => {
      this.assertGeneration(generation);
      return this.transport(`${server}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.tokens?.accessToken}`,
          "Content-Type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(45_000),
        redirect: "error",
        credentials: "omit",
      });
    };
    let response = await send();
    this.assertGeneration(generation);
    if (response.status === 401) {
      if (this.tokens?.accessToken === used) await this.refresh();
      response = await send();
    }
    const data = await response.json();
    this.assertGeneration(generation);
    if (!response.ok) {
      if (response.status === 401) await this.clear();
      throw new ApiError(
        data.error || "Could not complete the request.",
        response.status,
      );
    }
    return data as T;
  }
  async signOut() {
    await this.request("/api/mobile/me", "DELETE");
    await this.clear();
  }
}

export type Project = {
  id: string;
  name: string;
  supportConfig: { enabled: boolean } | null;
};
export type Me = {
  user: { id: string; name: string | null; email: string };
  projects: Project[];
};
export type Message = {
  id: string;
  role: string;
  authorName: string;
  content: string;
  createdAt: string;
  clientMessageId?: string;
  metadata?: { citations?: { url: string; title: string }[] };
};
export type Conversation = {
  id: string;
  state: string;
  revision: number;
  humanRequested: boolean;
  assignedToId: string | null;
  updatedAt: string;
  customer: { name: string | null; email: string | null; verified: boolean };
  messages: Message[];
  unread?: boolean;
  ticketReference: string | null;
  assignee?: { id: string; name: string | null } | null;
};
export type Inbox = {
  conversations: Conversation[];
  nextCursor: string | null;
};
export type Preferences = {
  enabled: boolean;
  onCall: boolean;
  quietUntil: string | null;
};
export type ProjectDetails = {
  preference: Preferences | null;
  teammates: { id: string; name: string | null }[];
};
export type Assistance = {
  text: string;
  revision: number;
  citations: { url: string; title: string }[];
  messageIds: string[];
};
export const projectPath = (id: string) =>
  `/api/mobile/projects/${encodeURIComponent(id)}`;
export const conversationPath = (id: string, cid: string) =>
  `/api/projects/${encodeURIComponent(id)}/support/conversations/${encodeURIComponent(cid)}`;
