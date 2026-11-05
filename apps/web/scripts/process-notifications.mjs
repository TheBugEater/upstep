// Run inside the app container. The cron secret stays in the runtime environment.
try {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET is not configured.");
  const response = await fetch(`http://127.0.0.1:${process.env.PORT || "3000"}/api/internal/notifications`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(55_000),
  });
  if (!response.ok) throw new Error(`Notification processing failed (HTTP ${response.status}).`);
  console.log(JSON.stringify(await response.json()));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Notification processing failed.");
  process.exitCode = 1;
}
