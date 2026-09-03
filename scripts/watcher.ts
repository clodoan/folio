import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { watch } from "chokidar";
import { ingestFile, loadIngestState } from "./ingest.ts";
import { INBOX_DIR } from "./paths.ts";
import { ingestOptionsFor, resolveWatchSpecs, specForPath } from "./watchTargets.ts";

const DEBOUNCE_MS = 400;

export type WatchSpec = { label: string; root: string };

export type WatcherHandle = {
  close: () => Promise<void>;
  specs: WatchSpec[];
};

export const startWatcher = (onIngest?: () => void): WatcherHandle => {
  mkdirSync(INBOX_DIR, { recursive: true });
  const allow = resolveWatchSpecs();
  const state = loadIngestState();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const watcher = watch(
    allow.map((s) => s.root),
    {
      ignoreInitial: false,
      persistent: true,
      awaitWriteFinish: { stabilityThreshold: 250, pollInterval: 50 },
    },
  );

  const schedule = (filePath: string) => {
    const abs = resolve(filePath);
    const spec = specForPath(allow, abs);
    if (!spec) return;

    const prev = timers.get(abs);
    if (prev) clearTimeout(prev);
    timers.set(
      abs,
      setTimeout(() => {
        timers.delete(abs);
        try {
          const result = ingestFile(abs, state, ingestOptionsFor(abs));
          if (!result.skipped && (result.events ?? 0) > 0) onIngest?.();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`ingest error ${abs}: ${msg}`);
        }
      }, DEBOUNCE_MS),
    );
  };

  watcher.on("add", schedule);
  watcher.on("change", schedule);
  watcher.on("error", (err) => console.error("watch error:", err));
  for (const s of allow) console.log(`watching ${s.label} ${s.root}`);

  return {
    specs: allow.map((s) => ({ label: s.label, root: s.root })),
    close: () => watcher.close(),
  };
};
