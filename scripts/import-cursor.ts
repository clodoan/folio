import { resolve } from "node:path";
import { loadFolioConfig } from "./folio-config.ts";
import { ingestFile, loadIngestState, withIngestLock } from "./ingest.ts";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i === -1) return undefined;
  return process.argv[i + 1];
}

function main() {
  const file = process.argv[2];
  if (!file || file.startsWith("-")) {
    console.error(
      "Usage: tsx scripts/import-cursor.ts <transcript.jsonl> [--provider cursor] [--agent name]",
    );
    process.exit(1);
  }

  const provider = argValue("--provider") ?? "cursor";
  const agent = argValue("--agent") ?? "cursor-agent";
  const abs = resolve(process.cwd(), file);
  const result = withIngestLock(() =>
    ingestFile(abs, loadIngestState(), {
      format: "transcript",
      defaults: { provider, agent, sourcePath: abs, timeZone: loadFolioConfig().timezone },
    }),
  );
  if (result.skipped) {
    console.log(`Skipped: ${result.reason}`);
    return;
  }
  console.log(
    `Imported ${result.events ?? 0} events (${result.mode}) days=${(result.days ?? []).join(",") || "-"}`,
  );
}

main();
