import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ingestFile, loadIngestState, withIngestLock } from "./ingest.ts";
import { ingestOptionsFor, resolveWatchSpecs, specForPath, type WatchSpec } from "./watchTargets.ts";

const collectAccepted = (dir: string, spec: WatchSpec, out: string[]): void => {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const abs = join(dir, e.name);
    if (e.isDirectory()) collectAccepted(abs, spec, out);
    else if (e.isFile() && specForPath([spec], abs)) out.push(abs);
  }
};

export const harvestFiles = (): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const spec of resolveWatchSpecs()) {
    if (!existsSync(spec.root)) continue;
    const found: string[] = [];
    collectAccepted(spec.root, spec, found);
    for (const abs of found) {
      if (seen.has(abs)) continue;
      seen.add(abs);
      out.push(abs);
    }
  }
  return out;
};

export const harvestOnce = (): number =>
  withIngestLock(() => {
    const state = loadIngestState();
    let added = 0;
    for (const abs of harvestFiles()) {
      try {
        const result = ingestFile(abs, state, ingestOptionsFor(abs));
        added += result.events ?? 0;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`harvest error ${abs}: ${msg}`);
      }
    }
    return added;
  });
