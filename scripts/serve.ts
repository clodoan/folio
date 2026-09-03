import { startLedgerRuntime } from "./runtime.ts";

const rt = await startLedgerRuntime();

function shutdown() {
  console.log("shutting down");
  void rt.close().then(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
