"use client";
import { useEffect, useState } from "react";

export function SupportProfile() {
  const [name, setName] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [fallbackName, setFallbackName] = useState("Teammate");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/account/support-profile", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load your support profile.");
        if (controller.signal.aborted) return;
        setName(data.supportDisplayName); setSaved(data.supportDisplayName); setFallbackName(data.fallbackName);
      }).catch((e) => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, []);
  return (
    <form className="rounded-2xl border border-line bg-card p-5 sm:p-6" onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setError(""); setNotice("");
      try {
        const response = await fetch("/api/account/support-profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ supportDisplayName: name }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not save your support name.");
        setName(data.supportDisplayName); setSaved(data.supportDisplayName); setFallbackName(data.fallbackName);
        setNotice("Your support name is saved.");
      } catch (e) { setError(e instanceof Error ? e.message : "Could not save your support name."); }
      finally { setBusy(false); }
    }}>
      <h2 className="text-sm font-semibold text-ink">Your support profile</h2>
      <p className="mt-1 text-xs leading-5 text-muted">Choose the name customers see on your new replies across your projects.</p>
      <label className="mt-4 block text-xs font-medium text-ink" htmlFor="support-display-name">Support display name</label>
      <input id="support-display-name" name="supportDisplayName" autoComplete="nickname" maxLength={80}
        disabled={saved === null || busy} value={name} onChange={(e) => { setName(e.target.value); setNotice(""); }}
        placeholder={fallbackName} className="mt-2 w-full max-w-md rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-clay disabled:opacity-50" />
      <p className="mt-2 text-xs text-muted">Customers will see <span className="font-medium text-ink">{name.trim() || fallbackName}</span>. Leave blank to use your account name. Earlier messages keep their original name.</p>
      <button type="submit" disabled={busy || saved === null || name.trim() === saved}
        className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-fg disabled:opacity-50">{busy ? "Saving…" : "Save support name"}</button>
      {error && <p role="alert" className="mt-3 text-xs text-danger">{error}</p>}
      {notice && <p role="status" className="mt-3 text-xs text-success">{notice}</p>}
    </form>
  );
}
