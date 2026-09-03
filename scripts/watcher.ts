import { homedir } from "node:os";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { watch } from "chokidar";
import { ingestFile, isIngestiblePath, loadIngestState } from "./ingest.ts";
import { extraWatchFromConfig } from "./folio-config.ts";
import { INBOX_DIR, ROOT, WATCH_CONFIG } from "./paths.ts";

const DEBOUNCE_MS = 400;

function extraWatchDirs(): string[] {
  const raw = `${process.env.LEDGER_WATCH ?? ""},${process.env.FOLIO_WATCH ?? ""}`;
  const fromEnv = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((p) => resolve(ROOT, p));
  const fromFile: string[] = [];
  try {
    if (existsSync(WATCH_CONFIG)) {
      const parsed = JSON.parse(readFileSync(WATCH_CONFIG, "utf8")) as { paths?: unknown };
      if (Array.isArray(parsed.paths)) {
        for (const p of parsed.paths) {
          if (typeof p === "string" && p.trim()) fromFile.push(resolve(ROOT, p));
        }
      }
    }
  } catch {
    /* skip */
  }
  return [...new Set([...fromEnv, ...fromFile, ...extraWatchFromConfig()])];
}

/** Allowlisted Cursor transcripts only — never the whole Cursor home tree. */
export function cursorTranscriptGlob(): string {
  return join(homedir(), ".cursor/projects/*/agent-transcripts/**/*.jsonl");
}

export function isCursorTranscriptPath(absPath: string): boolean {
  const norm = absPath.replace(/\\/g, "/");
  return /\/\.cursor\/projects\/[^/]+\/agent-transcripts\/.+\.jsonl$/i.test(norm);
}

export type WatchSpec = { label: string; root: string };

export type WatcherHandle = {
  close: () => Promise<void>;
  specs: WatchSpec[];
};

export function startWatcher(onIngest?: () => void): WatcherHandle {
  mkdirSync(INBOX_DIR, { recursive: true });
  const extras = extraWatchDirs();
  const cursorGlob = cursorTranscriptGlob();
  const state = loadIngestState();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const watcher = watch([INBOX_DIR, cursorGlob, ...extras], {
    ignoreInitial: false,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 250, pollInterval: 50 },
  });

  const schedule = (filePath: string) => {
    const abs = resolve(filePath);
    const inInbox = abs === INBOX_DIR || abs.startsWith(INBOX_DIR + "/");
    const inExtra = extras.some((d) => abs === d || abs.startsWith(d + "/"));
    const inCursor = isCursorTranscriptPath(abs);

    if (inInbox) {
      if (!isIngestiblePath(abs)) return;
    } else if (inCursor) {
      if (!abs.endsWith(".jsonl")) return;
    } else if (inExtra) {
      if (!abs.endsWith(".jsonl")) return;
    } else {
      return;
    }

    const prev = timers.get(abs);
    if (prev) clearTimeout(prev);
    timers.set(
      abs,
      setTimeout(() => {
        timers.delete(abs);
        try {
          const result = ingestFile(
            abs,
            state,
            inCursor
              ? {
                  forceCursor: true,
                  cursorDefaults: {
                    provider: "cursor",
                    agent: "cursor-agent",
                    sourcePath: abs,
                  },
                }
              : undefined,
          );
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
  console.log(`watching inbox ${INBOX_DIR}`);
  console.log(`watching cursor ${cursorGlob}`);
  for (const d of extras) console.log(`watching extra ${d} (*.jsonl)`);

  const specs: WatchSpec[] = [
    { label: "inbox", root: INBOX_DIR },
    { label: "cursor agent-transcripts", root: join(homedir(), ".cursor/projects") },
    ...extras.map((root) => ({ label: `LEDGER_WATCH ${root}`, root })),
  ];

  return {
    specs,
    close: () => watcher.close(),
  };
}
