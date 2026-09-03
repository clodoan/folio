import { startWatcher } from "./watcher.ts";

const watcher = startWatcher();
console.log("Folio harvest watching allowlisted jsonl. Ctrl+C to stop.");

function shutdown() {
  void watcher.close().then(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
