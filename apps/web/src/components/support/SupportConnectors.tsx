"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SupportIcon } from "./SupportIcons";
import { SupportSelect, type SelectOption } from "./SupportSelect";

type Scope = "CUSTOMER" | "PUBLIC";
type AuthType = "NONE" | "BEARER" | "HEADER";
type Action = {
  id: string;
  name: string;
  description: string;
  path: string;
  scope: Scope;
  enabled: boolean;
  inputs: { name: string; description: string }[];
  hiddenFields: string[];
};
type Connector = {
  id: string;
  name: string;
  baseUrl: string;
  authType: AuthType;
  authHeader: string | null;
  hasSecret: boolean;
  secretHint: string | null;
  enabled: boolean;
  actions: Action[];
};
type Draft = Omit<Connector, "id"> & { id: string | null; secret: string };
type Customer = { id: string; name: string | null; email: string | null };
type LookupResult = {
  ok: boolean;
  status: number | null;
  ms: number;
  data?: string;
  error?: string;
};
type Tab = "connect" | "actions" | "test";

const IDENTITY = ["customer_id", "customer_email"];
const field =
  "w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink outline-none transition placeholder:text-faint focus:border-clay";
const ghost =
  "inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-2 text-xs font-medium text-ink transition hover:bg-raised disabled:opacity-50";
const primary =
  "inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-fg transition hover:opacity-90 disabled:opacity-40";
const authOptions: SelectOption<AuthType>[] = [
  { value: "BEARER", label: "Bearer token", description: "Sends Authorization: Bearer <token>" },
  { value: "HEADER", label: "API key header", description: "Sends the key in a header you name" },
  { value: "NONE", label: "No authentication", description: "Only for public endpoints" },
];
const scopeOptions: SelectOption<Scope>[] = [
  {
    value: "CUSTOMER",
    label: "Customer data",
    dot: "bg-info",
    description: "Scoped to the signed-in customer via {customer_id} or {customer_email}",
  },
  {
    value: "PUBLIC",
    label: "Public",
    dot: "bg-faint",
    description: "Same answer for everyone, e.g. stock or opening hours",
  },
];

const newId = () => crypto.randomUUID().slice(0, 12);
const blankAction = (): Action => ({
  id: newId(),
  name: "",
  description: "",
  path: "/customers/{customer_id}",
  scope: "CUSTOMER",
  enabled: true,
  inputs: [],
  hiddenFields: [],
});
const blankDraft = (): Draft => ({
  id: null,
  name: "",
  baseUrl: "https://",
  authType: "BEARER",
  authHeader: null,
  hasSecret: false,
  secretHint: null,
  enabled: true,
  actions: [blankAction()],
  secret: "",
});
const toDraft = (c: Connector): Draft => ({ ...c, secret: "" });

// Keep declared inputs in step with the {placeholders} typed into the path.
function syncInputs(path: string, inputs: Action["inputs"]) {
  const used = [...path.matchAll(/\{([a-z][a-z0-9_]*)\}/g)]
    .map((m) => m[1]!)
    .filter((n) => !IDENTITY.includes(n));
  return [...new Set(used)].slice(0, 3).map(
    (name) => inputs.find((i) => i.name === name) || { name, description: "" },
  );
}
function pretty(data?: string) {
  if (!data) return "";
  try {
    return JSON.stringify(JSON.parse(data), null, 2);
  } catch {
    return data;
  }
}

export function SupportConnectors({ projectId }: { projectId: string }) {
  const endpoint = `/api/projects/${projectId}/support/connectors`;
  const [connectors, setConnectors] = useState<Connector[] | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState<string>("");
  const [tab, setTab] = useState<Tab>("connect");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [test, setTest] = useState<{
    actionId: string | null;
    customerId: string | null;
    inputs: Record<string, string>;
    result: LookupResult | null;
  }>({ actionId: null, customerId: null, inputs: {}, result: null });

  const request = useCallback(async (url: string, method = "GET", body?: unknown) => {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Could not complete the request.");
    return json;
  }, []);
  const load = useCallback(
    async (select?: string) => {
      try {
        const data = await request(endpoint);
        setConnectors(data.connectors);
        setCustomers(data.customers);
        const pick =
          data.connectors.find((c: Connector) => c.id === select) ||
          (select === undefined ? data.connectors[0] : null);
        if (pick) {
          setDraft(toDraft(pick));
          setSaved(JSON.stringify(toDraft(pick)));
        }
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [endpoint, request],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const dirty = !!draft && JSON.stringify(draft) !== saved;
  const update = (patch: Partial<Draft>) => {
    setNotice("");
    setDraft((d) => (d ? { ...d, ...patch } : d));
  };
  const updateAction = (id: string, patch: Partial<Action>) =>
    update({
      actions: draft!.actions.map((a) =>
        a.id === id
          ? {
              ...a,
              ...patch,
              ...(patch.path !== undefined
                ? { inputs: syncInputs(patch.path, a.inputs) }
                : {}),
            }
          : a,
      ),
    });
  const select = (c: Connector | null) => {
    if (dirty && !confirm("Discard unsaved changes to this connector?")) return;
    const next = c ? toDraft(c) : blankDraft();
    setDraft(next);
    setSaved(c ? JSON.stringify(next) : "");
    setTab(c ? "actions" : "connect");
    setOpen(c ? null : next.actions[0]!.id);
    setError("");
    setNotice("");
    setTest({ actionId: null, customerId: null, inputs: {}, result: null });
  };

  async function save() {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      const body = {
        name: draft.name,
        baseUrl: draft.baseUrl,
        authType: draft.authType,
        authHeader: draft.authType === "HEADER" ? draft.authHeader : null,
        ...(draft.secret.trim() ? { secret: draft.secret } : {}),
        enabled: draft.enabled,
        actions: draft.actions,
      };
      const { connector } = await request(
        draft.id ? `${endpoint}/${draft.id}` : endpoint,
        draft.id ? "PUT" : "POST",
        body,
      );
      await load(connector.id);
      setNotice(draft.id ? "Connector saved." : "Connector added. Test an action next.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!draft?.id || !confirm(`Remove ${draft.name}? The AI stops using it immediately.`))
      return;
    setBusy(true);
    try {
      await request(`${endpoint}/${draft.id}`, "DELETE");
      setDraft(null);
      setSaved("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function run() {
    if (!draft?.id || !test.actionId) return;
    setBusy(true);
    setError("");
    setTest((t) => ({ ...t, result: null }));
    try {
      const { result } = await request(`${endpoint}/${draft.id}/test`, "POST", {
        actionId: test.actionId,
        customerId: test.customerId,
        inputs: test.inputs,
      });
      setTest((t) => ({ ...t, result }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const testAction = draft?.actions.find((a) => a.id === test.actionId) || null;
  const actionOptions = useMemo<SelectOption<string>[]>(
    () =>
      (draft?.actions || [])
        .filter((a) => a.name)
        .map((a) => ({
          value: a.id,
          label: a.name,
          dot: a.scope === "CUSTOMER" ? "bg-info" : "bg-faint",
        })),
    [draft?.actions],
  );
  const customerOptions = useMemo<SelectOption<string>[]>(
    () =>
      customers.map((c) => ({
        value: c.id,
        label: c.name || c.email || "Signed-in customer",
        ...(c.name && c.email ? { description: c.email } : {}),
      })),
    [customers],
  );

  if (!connectors)
    return (
      <div className="rounded-2xl border border-line bg-card p-8 text-sm text-muted">
        {error || "Loading connectors…"}
      </div>
    );

  return (
    <div className="grid overflow-visible rounded-2xl border border-line bg-card md:grid-cols-[290px_minmax(0,1fr)]">
      <aside className="flex flex-col gap-5 border-b border-line bg-surface p-5 md:rounded-l-2xl md:border-b-0 md:border-r">
        <div>
          <h2 className="text-sm font-semibold text-ink">Connectors</h2>
          <p className="mt-1.5 text-xs leading-5 text-muted">
            Let the AI look up the signed-in customer&apos;s orders, plan or bookings
            from your own API. Lookups only: nothing here can change data.
          </p>
        </div>
        {connectors.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="px-1 text-[11px] font-semibold uppercase tracking-wide text-faint">
              Connected
            </span>
            {connectors.map((c) => (
              <button
                key={c.id}
                onClick={() => select(c)}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${draft?.id === c.id ? "border-ink bg-card" : "border-transparent hover:bg-raised"}`}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-card text-xs font-bold text-ink">
                  {c.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{c.name}</span>
                  <span className="block truncate text-xs text-faint">
                    {c.actions.filter((a) => a.enabled).length} active action
                    {c.actions.filter((a) => a.enabled).length === 1 ? "" : "s"}
                  </span>
                </span>
                <span className={`flex items-center gap-1.5 text-[11px] ${c.enabled ? "text-success" : "text-faint"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${c.enabled ? "bg-success" : "bg-faint"}`} />
                  {c.enabled ? "Live" : "Paused"}
                </span>
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => select(null)}
          className={`flex items-start gap-3 rounded-xl border border-dashed px-3 py-3 text-left transition hover:bg-raised ${draft && !draft.id ? "border-ink bg-card" : "border-line-strong"}`}
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-clay-tint text-clay">
            <SupportIcon name="plug" className="h-4 w-4" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-ink">Connect your API</span>
            <span className="mt-0.5 block text-xs leading-5 text-muted">
              Any HTTPS endpoint that returns JSON
            </span>
          </span>
        </button>
        <p className="px-1 text-xs leading-5 text-faint">
          Ready-made Shopify, Stripe and HubSpot connectors are coming. Until then,
          point a custom connector at their read-only APIs or your own.
        </p>
        <div className="mt-auto flex gap-2.5 rounded-xl border border-line bg-card p-3">
          <SupportIcon name="shield" className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <p className="text-xs leading-5 text-muted">
            <strong className="text-ink">Safe by design.</strong> GET only, public
            HTTPS only, scoped to the signed-in customer, tokens encrypted, sensitive
            fields removed. Refunds and changes still go to your team.
          </p>
        </div>
      </aside>

      <section className="min-w-0 p-5 md:p-6">
        {!draft ? (
          <div className="grid h-full min-h-[360px] place-items-center text-center">
            <div className="max-w-sm">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-clay-tint text-clay">
                <SupportIcon name="database" className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-ink">
                Answer “where’s my order?” without a teammate
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted">
                Connect a read-only endpoint and the AI can check this customer&apos;s
                live data before replying, then hand off anything that needs a change.
              </p>
              <button onClick={() => select(null)} className={`${primary} mt-5`}>
                <SupportIcon name="plus" className="h-3.5 w-3.5" />
                Connect your API
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-clay-tint text-sm font-bold text-clay">
                {(draft.name || "API").slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-base font-semibold text-ink">
                    {draft.name || "New connector"}
                  </h3>
                  {draft.id && (
                    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${draft.enabled ? "bg-success/10 text-success" : "bg-raised text-faint"}`}>
                      {draft.enabled ? "Live" : "Paused"}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-md border border-line px-1.5 py-0.5 text-[11px] font-semibold text-ink-soft">
                    <SupportIcon name="lock" className="h-3 w-3" />
                    Read-only
                  </span>
                </div>
                <p className="mt-0.5 truncate font-mono text-xs text-faint">
                  {draft.baseUrl.replace(/^https:\/\/$/, "") || "No URL yet"}
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  role="switch"
                  checked={draft.enabled}
                  onChange={(e) => update({ enabled: e.target.checked })}
                  className="peer sr-only"
                />
                <span className="relative h-5 w-9 rounded-full bg-line-strong transition peer-checked:bg-success peer-focus-visible:ring-2 peer-focus-visible:ring-clay after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4" />
                AI can use it
              </label>
              {draft.id && (
                <button onClick={() => void remove()} disabled={busy} className={ghost} aria-label="Remove connector">
                  <SupportIcon name="trash" className="h-3.5 w-3.5" />
                </button>
              )}
              <button onClick={() => void save()} disabled={busy || (!dirty && !!draft.id)} className={primary}>
                {busy ? "Saving…" : draft.id ? "Save changes" : "Add connector"}
              </button>
            </div>

            {error && (
              <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm text-danger">
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="rounded-lg bg-success/10 px-3 py-2.5 text-sm text-ink">
                {notice}
              </p>
            )}

            <div role="tablist" aria-label="Connector setup" className="flex gap-1 border-b border-line">
              {(
                [
                  ["connect", "Connect"],
                  ["actions", `Actions · ${draft.actions.length}`],
                  ["test", "Test"],
                ] as [Tab, string][]
              ).map(([value, label], i) => (
                <button
                  key={value}
                  role="tab"
                  aria-selected={tab === value}
                  onClick={() => setTab(value)}
                  className={`-mb-px flex items-center gap-2 border-b-2 px-3 pb-2.5 pt-1 text-sm transition ${tab === value ? "border-ink font-semibold text-ink" : "border-transparent text-muted hover:text-ink"}`}
                >
                  <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${tab === value ? "bg-ink text-canvas" : "bg-raised text-muted"}`}>
                    {i + 1}
                  </span>
                  {label}
                </button>
              ))}
            </div>

            {tab === "connect" && (
              <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
                  Name
                  <input
                    className={field}
                    value={draft.name}
                    maxLength={60}
                    placeholder="Orders API"
                    onChange={(e) => update({ name: e.target.value })}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
                  Base URL
                  <input
                    className={`${field} font-mono`}
                    value={draft.baseUrl}
                    maxLength={300}
                    placeholder="https://api.example.com/v1"
                    onChange={(e) => update({ baseUrl: e.target.value })}
                  />
                </label>
                <div className="flex flex-col gap-1.5 text-xs font-medium text-muted">
                  Authentication
                  <SupportSelect
                    label="Authentication"
                    value={draft.authType}
                    options={authOptions}
                    onChange={(authType) => update({ authType })}
                  />
                </div>
                {draft.authType === "HEADER" && (
                  <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
                    Header name
                    <input
                      className={`${field} font-mono`}
                      value={draft.authHeader || ""}
                      maxLength={64}
                      placeholder="X-Api-Key"
                      onChange={(e) => update({ authHeader: e.target.value })}
                    />
                  </label>
                )}
                {draft.authType !== "NONE" && (
                  <label className="flex flex-col gap-1.5 text-xs font-medium text-muted sm:col-span-2">
                    {draft.authType === "BEARER" ? "Token" : "API key"}
                    <input
                      type="password"
                      autoComplete="off"
                      className={`${field} font-mono`}
                      value={draft.secret}
                      maxLength={4096}
                      placeholder={
                        draft.hasSecret
                          ? `Saved${draft.secretHint ? ` · ends in ${draft.secretHint}` : ""}. Leave blank to keep it.`
                          : "Paste a read-only key"
                      }
                      onChange={(e) => update({ secret: e.target.value })}
                    />
                    <span className="font-normal text-faint">
                      Use a key that can only read. It&apos;s encrypted at rest and never shown
                      to the AI, your team or the customer.
                    </span>
                  </label>
                )}
                <div className="flex items-start gap-3 rounded-xl border border-line bg-surface p-3.5 sm:col-span-2">
                  <SupportIcon name="lock" className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <p className="text-xs leading-5 text-muted">
                    <strong className="text-ink">GET requests only, always.</strong> Upstep
                    never sends POST, PUT, PATCH or DELETE, doesn&apos;t follow redirects, and
                    refuses private network addresses. Calls time out after 6 seconds.
                  </p>
                </div>
              </div>
            )}

            {tab === "actions" && (
              <div className="flex max-w-4xl flex-col gap-3">
                <p className="text-sm leading-6 text-muted">
                  Each action is one lookup the AI can choose to make. The description is
                  what the AI reads to decide when to use it, so write it like a brief for
                  a new teammate.
                </p>
                {draft.actions.map((a) => {
                  const expanded = open === a.id;
                  return (
                    <div key={a.id} className="rounded-xl border border-line bg-card">
                      <div className="flex flex-wrap items-center gap-2.5 px-4 py-3">
                        <button
                          onClick={() => setOpen(expanded ? null : a.id)}
                          aria-expanded={expanded}
                          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                        >
                          <SupportIcon
                            name="chevron"
                            className={`h-3.5 w-3.5 shrink-0 text-faint transition ${expanded ? "" : "-rotate-90"}`}
                          />
                          <span className="truncate font-mono text-sm text-ink">
                            {a.name || "unnamed_action"}
                          </span>
                          <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${a.scope === "CUSTOMER" ? "bg-info/10 text-info" : "bg-raised text-muted"}`}>
                            {a.scope === "CUSTOMER" ? "Customer data" : "Public"}
                          </span>
                          <span className="hidden truncate font-mono text-xs text-faint sm:inline">
                            GET {a.path}
                          </span>
                        </button>
                        <label className="flex items-center gap-2 text-xs text-muted">
                          <input
                            type="checkbox"
                            role="switch"
                            checked={a.enabled}
                            onChange={(e) => updateAction(a.id, { enabled: e.target.checked })}
                            className="peer sr-only"
                          />
                          <span className="relative h-5 w-9 rounded-full bg-line-strong transition peer-checked:bg-success peer-focus-visible:ring-2 peer-focus-visible:ring-clay after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4" />
                          <span className="sr-only">Action enabled</span>
                        </label>
                        <button
                          onClick={() => update({ actions: draft.actions.filter((x) => x.id !== a.id) })}
                          aria-label={`Remove ${a.name || "action"}`}
                          className="rounded-md p-1.5 text-faint transition hover:bg-raised hover:text-ink"
                        >
                          <SupportIcon name="trash" className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {expanded && (
                        <div className="grid gap-4 border-t border-line p-4 sm:grid-cols-2">
                          <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
                            Name
                            <input
                              className={`${field} font-mono`}
                              value={a.name}
                              maxLength={48}
                              placeholder="get_order_status"
                              onChange={(e) =>
                                updateAction(a.id, {
                                  name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                                })
                              }
                            />
                          </label>
                          <div className="flex flex-col gap-1.5 text-xs font-medium text-muted">
                            Returns
                            <SupportSelect
                              label="Data scope"
                              value={a.scope}
                              options={scopeOptions}
                              onChange={(scope) => updateAction(a.id, { scope })}
                            />
                          </div>
                          <label className="flex flex-col gap-1.5 text-xs font-medium text-muted sm:col-span-2">
                            Path
                            <div className="flex items-center overflow-hidden rounded-lg border border-line bg-card focus-within:border-clay">
                              <span className="border-r border-line bg-surface px-3 py-2 font-mono text-xs font-semibold text-success">
                                GET
                              </span>
                              <input
                                className="min-w-0 flex-1 bg-transparent px-3 py-2 font-mono text-sm text-ink outline-none"
                                value={a.path}
                                maxLength={500}
                                onChange={(e) => updateAction(a.id, { path: e.target.value })}
                              />
                            </div>
                            <span className="font-normal leading-5 text-faint">
                              <code className="text-ink-soft">{"{customer_id}"}</code> and{" "}
                              <code className="text-ink-soft">{"{customer_email}"}</code> come from the
                              signed-in customer, never from chat. Other{" "}
                              <code className="text-ink-soft">{"{placeholders}"}</code> become inputs the
                              AI fills from what the customer wrote, like an order number.
                            </span>
                          </label>
                          <label className="flex flex-col gap-1.5 text-xs font-medium text-muted sm:col-span-2">
                            When should the AI use it?
                            <textarea
                              className={`${field} resize-y leading-6`}
                              rows={2}
                              maxLength={500}
                              value={a.description}
                              placeholder="Use when the customer asks where their order is or when it will arrive."
                              onChange={(e) => updateAction(a.id, { description: e.target.value })}
                            />
                          </label>
                          {a.inputs.map((input) => (
                            <label key={input.name} className="flex flex-col gap-1.5 text-xs font-medium text-muted sm:col-span-2">
                              <span>
                                Input <code className="font-mono text-ink">{input.name}</code>
                              </span>
                              <input
                                className={field}
                                value={input.description}
                                maxLength={200}
                                placeholder="The order number, like NW-20418"
                                onChange={(e) =>
                                  updateAction(a.id, {
                                    inputs: a.inputs.map((x) =>
                                      x.name === input.name ? { ...x, description: e.target.value } : x,
                                    ),
                                  })
                                }
                              />
                            </label>
                          ))}
                          <label className="flex flex-col gap-1.5 text-xs font-medium text-muted sm:col-span-2">
                            Hide these fields from the AI
                            <input
                              className={`${field} font-mono`}
                              value={a.hiddenFields.join(", ")}
                              placeholder="shipping_address, phone, customer.notes"
                              onChange={(e) =>
                                updateAction(a.id, {
                                  hiddenFields: e.target.value
                                    .split(",")
                                    .map((x) => x.trim())
                                    .filter(Boolean)
                                    .slice(0, 40),
                                })
                              }
                            />
                            <span className="font-normal text-faint">
                              Passwords, tokens, card and account numbers are always removed.
                            </span>
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
                <button
                  disabled={draft.actions.length >= 10}
                  onClick={() => {
                    const a = blankAction();
                    update({ actions: [...draft.actions, a] });
                    setOpen(a.id);
                  }}
                  className={`${ghost} self-start`}
                >
                  <SupportIcon name="plus" className="h-3.5 w-3.5" />
                  Add action
                </button>
              </div>
            )}

            {tab === "test" && (
              <div className="flex max-w-4xl flex-col gap-4">
                {!draft.id || dirty ? (
                  <p className="rounded-xl border border-dashed border-line-strong p-5 text-sm text-muted">
                    Save your changes first. Tests run the saved connector exactly as the AI would.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="flex min-w-[200px] flex-col gap-1.5 text-xs font-medium text-muted">
                        Action
                        <SupportSelect
                          label="Action to test"
                          value={test.actionId}
                          options={actionOptions}
                          placeholder="Choose an action"
                          onChange={(actionId) => setTest({ ...test, actionId, inputs: {}, result: null })}
                        />
                      </div>
                      {testAction?.scope === "CUSTOMER" && (
                        <div className="flex min-w-[220px] flex-col gap-1.5 text-xs font-medium text-muted">
                          As customer
                          <SupportSelect
                            label="Customer to test as"
                            value={test.customerId}
                            options={customerOptions}
                            placeholder={customers.length ? "Choose a signed-in customer" : "No signed-in customers yet"}
                            disabled={!customers.length}
                            onChange={(customerId) => setTest({ ...test, customerId, result: null })}
                          />
                        </div>
                      )}
                      {testAction?.inputs.map((input) => (
                        <label key={input.name} className="flex min-w-[160px] flex-col gap-1.5 text-xs font-medium text-muted">
                          <code className="font-mono">{input.name}</code>
                          <input
                            className={field}
                            value={test.inputs[input.name] || ""}
                            maxLength={120}
                            placeholder={input.description || input.name}
                            onChange={(e) =>
                              setTest({ ...test, inputs: { ...test.inputs, [input.name]: e.target.value } })
                            }
                          />
                        </label>
                      ))}
                      <button
                        onClick={() => void run()}
                        disabled={busy || !testAction || (testAction.scope === "CUSTOMER" && !test.customerId)}
                        className={primary}
                      >
                        {busy ? "Running…" : "Run lookup"}
                      </button>
                    </div>
                    {testAction?.scope === "CUSTOMER" && !customers.length && (
                      <p className="text-xs leading-5 text-muted">
                        Customer actions only run for customers signed in through identity
                        verification. Once one starts a chat, you can test as them here.
                      </p>
                    )}
                    {test.result && (
                      <div className="overflow-hidden rounded-xl border border-line">
                        <div className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-2.5 text-xs">
                          <span className={`font-semibold ${test.result.ok ? "text-success" : "text-danger"}`}>
                            {test.result.ok ? `HTTP ${test.result.status}` : "Failed"}
                          </span>
                          <span className="text-faint">{test.result.ms} ms</span>
                          <span className="ml-auto text-faint">Exactly what the AI receives</span>
                        </div>
                        <pre className="max-h-80 overflow-auto bg-card p-4 font-mono text-xs leading-6 text-ink-soft">
                          {test.result.ok ? pretty(test.result.data) : test.result.error}
                        </pre>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
