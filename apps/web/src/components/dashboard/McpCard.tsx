"use client";

import { useState } from "react";

const TOOL_LIST = [
  ["get_project_overview", "counts, columns, top-voted"],
  ["list_feedback", "browse & search by votes"],
  ["get_feedback", "full item + comments"],
  ["create_feedback", "Dev-only tasks, hidden from users"],
  ["update_feedback", "move columns, edit"],
  ["add_comment", "reply as the team"],
  ["list_boards", "see every board"],
  ["create_board", "separate agent workspace"],
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

  const mcpUrl = `${baseUrl.replace(/\/$/, "")}/api/mcp`;
  const displayKey = mcpKey ?? "YOUR_MCP_KEY";
  const snippets = {
    claude: `claude mcp add --transport http upstep ${mcpUrl} --header "Authorization: Bearer ${displayKey}"`,
    codex: `export UPSTEP_MCP_KEY="${displayKey}"
codex mcp add upstep --url ${mcpUrl} --bearer-token-env-var UPSTEP_MCP_KEY`,
    cursor: `{
  "mcpServers": {
    "upstep": {
      "url": "${mcpUrl}",
      "headers": { "Authorization": "Bearer ${displayKey}" }
    }
  }
}`,
  };

  async function generate() {
    if (configured && !window.confirm("Rotate the MCP key? Existing agent connections will stop working immediately.")) return;
    setWorking(true);
    setError("");
    try {
      const response = await fetch(`/api/projects/${projectId}/mcp-key`, { method: "POST" });
      const data = (await response.json()) as { mcpKey?: string; error?: string };
      if (!response.ok || !data.mcpKey) throw new Error(data.error ?? "Could not generate MCP key");
      setMcpKey(data.mcpKey);
      setConfigured(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate MCP key");
    } finally {
      setWorking(false);
    }
  }

  async function revoke() {
    if (!window.confirm("Revoke MCP access for this project? Connected agents will stop working.")) return;
    setWorking(true);
    setError("");
    try {
      const response = await fetch(`/api/projects/${projectId}/mcp-key`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not revoke MCP access");
      setMcpKey(null);
      setConfigured(false);
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
                {configured ? "Connected" : "Not configured"}
              </span>
            </div>
            <p className="mt-1 max-w-lg text-xs leading-relaxed text-muted">
              Give an AI agent project-scoped access to triage, create and update feedback. MCP uses a private key that is separate from the public widget key.
            </p>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-clay/10 text-base text-clay">✦</span>
        </div>

        {!isOwner ? (
          <div className="mt-5 rounded-xl border border-line bg-surface/60 p-4 text-xs text-muted">
            Only the project owner can generate or rotate the MCP key. Ask them to share it through your team&apos;s password manager.
          </div>
        ) : (
          <>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button onClick={() => void generate()} disabled={working} className="rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-fg transition hover:bg-primary/85 disabled:opacity-50">
                {working ? "Working…" : configured ? "Rotate MCP key" : "Generate MCP key"}
              </button>
              {configured && <button onClick={() => void revoke()} disabled={working} className="rounded-lg border border-line px-3 py-2 text-xs font-medium text-muted transition hover:border-danger/30 hover:text-danger disabled:opacity-50">Revoke</button>}
            </div>
            {error && <p className="mt-2 text-xs text-danger">{error}</p>}

            {configured && !mcpKey && (
              <div className="mt-4 rounded-xl border border-line bg-surface/60 p-4 text-xs leading-relaxed text-muted">
                The key is stored only as a hash and cannot be shown again. Rotate it to receive a new plaintext key.
              </div>
            )}

            {mcpKey && (
              <div className="mt-4 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
                Save this command now. The MCP key will not be shown again after you leave this page.
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

            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all rounded-xl bg-[#1C1B19] p-4 font-mono text-[11.5px] leading-relaxed text-white/85">
              {snippets[tab]}
            </pre>
          </>
        )}
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
