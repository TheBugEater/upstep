// Tests must never inherit live mail credentials or make unmocked requests.
// Loaded in each test process before the application modules are imported.
delete process.env.SENDPANDA_API_KEY;
globalThis.fetch = async () => {
  throw new Error("Network requests are disabled in tests; mock fetch explicitly.");
};
