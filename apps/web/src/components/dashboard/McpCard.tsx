"use client";

import { useCallback, useEffect, useState } from "react";

const TOOL_LIST = [
  ["get_project_overview", "counts, columns, top-voted"],
  ["list_feedback", "browse & search by votes"],
  ["get_feedback", "full item + comments"],
  ["create_feedback", "Dev-only tasks, hidden from users"],
  ["update_feedback", "start work, complete tasks, edit"],
  ["add_comment", "reply as the authenticated teammate"],
  ["list_boards", "see every board"],
  ["create_board", "owner/admin workspace setup"],
] as const;

type ClientTab = "claude" | "codex" | "cursor";

export function McpCard({
  projectId,
  baseUrl,
  configured: initiallyConfigured,
  isOwner,
}: {
  projectId: string;
  baseUrl: string;
  configured: boolean;
  isOwner: boolean;
}) {
  const [tab, setTab] = useState<ClientTab>("claude");
  const [mcpKey, setMcpKey] = useState<string | null>(null);
  const [configured, setConfigured] = useState(initiallyConfigured);
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [legacyConfigured, setLegacyConfigured] = useState(false);
  const [teamKeys, setTeamKeys] = useState<{ userId: string; name: string }[]>([]);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(`/api/projects/${projectId}/mcp-key`, { cache: "no-store", ...(signal ? { signal } : {}) });
    const data = await response.json();
    if (signal?.aborted) return;
    if (!response.ok) throw new Error(data.error ?? "Could not load MCP access");
    setConfigured(data.configured);
    if (!data.configured) setMcpKey(null);
    setLegacyConfigured(data.legacyConfigured);
    setTeamKeys(data.keys ?? []);
  }, [projectId]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setMcpKey(null);
    setLegacyConfigured(false);
    setTeamKeys([]);
    void refresh(controller.signal).catch(() => {
      if (!controller.signal.aborted) setError("Could not load MCP access. Refresh to try again.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);

  const mcpUrl = `${baseUrl.replace(/\/$/, "")}/api/mcp`;
  const displayKey = mcpKey ?? "YOUR_MCP_KEY";
  const serverName = `upstep-${projectId}`;
  const envName = `UPSTEP_MCP_${projectId.replace(/[^a-zA-Z0-9_]/g, "_").toUpperCase()}_KEY`;
  const snippets = {
    claude: `claude mcp add --transport http ${serverName} ${mcpUrl} --header "Authorization: Bearer ${displayKey}"`,
    codex: `export ${envName}="${displayKey}"
codex mcp add ${serverName} --url ${mcpUrl} --bearer-token-env-var ${envName}`,
    cursor: `{
  "mcpServers": {
    "${serverName}": {
      "url": "${mcpUrl}",
      "headers": { "Authorization": "Bearer ${displayKey}" }
    }
  }
}`,
  };

  async function generate() {
    if (configured && !window.confirm("Rotate your MCP key for this project? Only connections using your current personal key will stop working.")) return;
    setWorking(true);
    setError("");
    try {
      const response = await fetch(`/api/projects/${projectId}/mcp-key`, { method: "POST" });
      const data = (await response.json()) as { mcpKey?: string; error?: string };
      if (!response.ok || !data.mcpKey) throw new Error(data.error ?? "Could not generate MCP key");
      setMcpKey(data.mcpKey);
      setConfigured(true);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate MCP key");
    } finally {
      setWorking(false);
    }
  }

  async function revoke(target?: { userId: string; name: string } | "legacy") {
    const message = target === "legacy" ? "Revoke the legacy shared key? Every connection still using that key will stop working. Personal keys will keep working."
      : target ? `Revoke ${target.name}'s personal MCP key for this project? Their connections using it will stop working.`
      : "Revoke your personal MCP key for this project? Only connections using this key will stop working.";
    if (!window.confirm(message)) return;
    setWorking(true);
    setError("");
    try {
      const query = target === "legacy" ? "?legacy=1" : target ? `?userId=${encodeURIComponent(target.userId)}` : "";
      const response = await fetch(`/api/projects/${projectId}/mcp-key${query}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not revoke MCP access");
      if (!target) { setMcpKey(null); setConfigured(false); }
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not revoke MCP access");
    } finally {
      setWorking(false);
    }
  }

  async function copy() {
    if (!mcpKey) return;
    await navigator.clipboard.writeText(snippets[tab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-clay/25 bg-card shadow-soft">
      <div className="p-6 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-ink">MCP server</h3>
              <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${configured ? "border-success/25 bg-success/10 text-success" : "border-line bg-surface text-faint"}`}>
                {configured ? "Your key ready" : "No personal key"}
              </span>
            </div>
            <p className="mt-1 max-w-lg text-xs leading-relaxed text-muted">
              Connect your AI agent with a key belonging to you and this project. Every teammate manages their own key; comments use their authenticated name, and removing a teammate revokes their personal access.
            </p>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-clay/10 text-base text-clay">✦</span>
        </div>

        {legacyConfigured && <div className="mt-4 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs leading-relaxed text-ink">
          A legacy shared key is still active. It cannot identify individual teammates. Generate personal keys and reconnect your clients; remove the old shared connection from each client.
          {isOwner && <button onClick={() => void revoke("legacy")} disabled={working || loading} className="mt-2 block font-semibold underline disabled:opacity-50">Revoke legacy shared key</button>}
        </div>}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button onClick={() => void generate()} disabled={working || loading} className="rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-fg transition hover:bg-primary/85 disabled:opacity-50">
              {working ? "Working…" : configured ? "Rotate my MCP key" : "Generate my MCP key"}
            </button>
            {configured && <button onClick={() => void revoke()} disabled={working || loading} className="rounded-lg border border-line px-3 py-2 text-xs font-medium text-muted transition hover:border-danger/30 hover:text-danger disabled:opacity-50">Revoke my key</button>}
          </div>
          {error && <p className="mt-2 text-xs text-danger">{error}</p>}

          {configured && !mcpKey && (
            <div className="mt-4 rounded-xl border border-line bg-surface/60 p-4 text-xs leading-relaxed text-muted">
              Your personal key is stored only as a hash and cannot be shown again. Rotate it to receive a new key. Other teammates keep their own connections.
            </div>
          )}

          {mcpKey && (
            <div className="mt-4 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
              Save your command now. This personal key will not be shown again after you leave this page. Keep it private.
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {(["claude", "codex", "cursor"] as const).map((client) => (
              <button key={client} onClick={() => setTab(client)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${tab === client ? "bg-primary text-primary-fg" : "border border-line text-muted hover:text-ink"}`}>
                {client === "claude" ? "Claude Code" : client === "codex" ? "Codex CLI" : "Cursor / JSON"}
              </button>
            ))}
            <button onClick={() => void copy()} disabled={!mcpKey} className="ml-auto rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-40">
              {copied ? "Copied ✓" : "Copy command"}
            </button>
          </div>

          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all rounded-xl bg-black p-4 font-mono text-[11.5px] leading-relaxed text-white/85">
            {snippets[tab]}
          </pre>
        {isOwner && teamKeys.length > 0 && <div className="mt-5 border-t border-line pt-4">
          <p className="text-xs font-semibold text-ink">Team MCP access</p>
          <p className="mt-1 text-xs text-muted">Revoke a personal key without affecting the rest of the team. Key values are never shown here.</p>
          <div className="mt-3 space-y-2">{teamKeys.map((key) => <div key={key.userId} className="flex items-center justify-between gap-3 text-xs">
            <span className="truncate text-ink">{key.name}</span>
            <button onClick={() => void revoke(key)} disabled={working || loading} className="shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-muted hover:text-danger disabled:opacity-50">Revoke access</button>
          </div>)}</div>
        </div>}
      </div>

      <div className="border-t border-line bg-surface/50 px-6 py-4">
        <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-faint">Available tools</p>
        <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
          {TOOL_LIST.map(([name, description]) => (
            <div key={name} className="flex min-w-0 items-baseline gap-2">
              <code className="shrink-0 font-mono text-[11px] text-clay">{name}</code>
              <span className="truncate text-[11px] text-faint">{description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
