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

/** Connect-your-AI card shown on the MCP tab. Available on all plans. */
export function McpCard({ apiKey, baseUrl }: { apiKey: string; baseUrl: string }) {
  const [tab, setTab] = useState<"claude" | "codex" | "cursor">("claude");
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const mcpUrl = `${baseUrl.replace(/\/$/, "")}/api/mcp`;
  const key = revealed ? apiKey : "YOUR_API_KEY";
  const claudeCmd = `claude mcp add --transport http upstep ${mcpUrl} --header "Authorization: Bearer ${key}"`;
  const codexCmd = `export UPSTEP_API_KEY="${key}"
codex mcp add upstep --url ${mcpUrl} --bearer-token-env-var UPSTEP_API_KEY`;
  const cursorJson = `{
  "mcpServers": {
    "upstep": {
      "url": "${mcpUrl}",
      "headers": { "Authorization": "Bearer ${key}" }
    }
  }
}`;
  const snippet = tab === "claude" ? claudeCmd : tab === "codex" ? codexCmd : cursorJson;

  async function copy() {
    // Always copy the real key, even while the display is masked
    const real = tab === "claude"
      ? claudeCmd.replace("YOUR_API_KEY", apiKey)
      : tab === "codex"
        ? codexCmd.replace("YOUR_API_KEY", apiKey)
        : cursorJson.replace("YOUR_API_KEY", apiKey);
    await navigator.clipboard.writeText(real);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="rounded-2xl border border-clay/25 bg-card shadow-soft overflow-hidden">
      <div className="p-6 pb-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-ink">MCP server</h3>
              <span className="text-[9px] font-bold uppercase tracking-wide text-clay bg-clay/10 border border-clay/25 rounded-full px-2 py-0.5">
                AI-native
              </span>
            </div>
            <p className="text-xs text-muted mt-1 max-w-md leading-relaxed">
              Connect Claude Code, Codex, Cursor, Windsurf, Copilot, or any MCP
              client. Your agent can triage feedback, file Dev-only tasks users
              never see, and run its own board. Scoped by your project API key.
            </p>
          </div>
          <span className="w-9 h-9 rounded-xl bg-clay/10 text-clay flex items-center justify-center text-base shrink-0">✦</span>
        </div>

        {/* Client tabs */}
        <div className="mt-4 flex items-center gap-1.5">
          {(["claude", "codex", "cursor"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                tab === t
                  ? "bg-primary text-primary-fg"
                  : "text-muted hover:text-ink border border-line"
              }`}
            >
              {t === "claude" ? "Claude Code" : t === "codex" ? "Codex CLI" : "Cursor / JSON"}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => setRevealed((v) => !v)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-line text-muted hover:text-ink transition"
            >
              {revealed ? "Hide key" : "Show key"}
            </button>
            <button
              onClick={copy}
              className={`text-xs px-2.5 py-1.5 rounded-lg border transition ${
                copied
                  ? "border-success/30 bg-success/10 text-success"
                  : "border-line text-muted hover:text-ink"
              }`}
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
        </div>

        <pre className="mt-3 rounded-xl bg-[#1C1B19] text-white/85 text-[11.5px] font-mono leading-relaxed p-4 overflow-x-auto whitespace-pre-wrap break-all">
          {snippet}
        </pre>
        {tab === "codex" && (
          <p className="mt-2 text-[11px] text-faint leading-relaxed">
            Codex stores the env var name, so keep <code className="font-mono">UPSTEP_API_KEY</code> set in the shell or launcher you use to run it.
          </p>
        )}
      </div>

      {/* Tool catalogue */}
      <div className="border-t border-line bg-surface/50 px-6 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-faint mb-2.5">
          Available tools
        </p>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
          {TOOL_LIST.map(([name, desc]) => (
            <div key={name} className="flex items-baseline gap-2 min-w-0">
              <code className="text-[11px] text-clay font-mono shrink-0">{name}</code>
              <span className="text-[11px] text-faint truncate">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
