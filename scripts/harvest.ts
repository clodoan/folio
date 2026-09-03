import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { ingestFile, isIngestiblePath, loadIngestState } from "./ingest.ts";
import { extraWatchFromConfig } from "./folio-config.ts";
import { INBOX_DIR, ROOT, WATCH_CONFIG } from "./paths.ts";
import { isSecretPath } from "./watchTargets.ts";

function collectJsonl(dir: string, out: string[]): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const abs = join(dir, e.name);
    if (e.isDirectory()) collectJsonl(abs, out);
    else if (e.isFile() && e.name.endsWith(".jsonl") && !isSecretPath(abs)) out.push(abs);
  }
}

export function cursorTranscriptFiles(): string[] {
  const projects = join(homedir(), ".cursor/projects");
  if (!existsSync(projects)) return [];
  const out: string[] = [];
  let dirs;
  try {
    dirs = readdirSync(projects, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const proj of dirs) {
    if (!proj.isDirectory()) continue;
    collectJsonl(join(projects, proj.name, "agent-transcripts"), out);
  }
  return out;
}

function extraDirs(): string[] {
  const fromEnv = `${process.env.LEDGER_WATCH ?? ""},${process.env.FOLIO_WATCH ?? ""}`
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((p) => resolve(ROOT, p));
  const fromFile: string[] = [];
  try {
    const raw = JSON.parse(readFileSync(WATCH_CONFIG, "utf8")) as { paths?: unknown };
    if (Array.isArray(raw.paths)) {
      for (const p of raw.paths) {
        if (typeof p === "string" && p.trim()) fromFile.push(resolve(ROOT, p));
      }
    }
  } catch {
    /* missing */
  }
  return [...fromEnv, ...fromFile, ...extraWatchFromConfig()];
}

function inboxFiles(): string[] {
  if (!existsSync(INBOX_DIR)) return [];
  const out: string[] = [];
  for (const name of readdirSync(INBOX_DIR)) {
    const abs = join(INBOX_DIR, name);
    if (isIngestiblePath(abs) && !isSecretPath(abs)) out.push(abs);
  }
  return out;
}

function extraFiles(): string[] {
  const out: string[] = [];
  for (const d of extraDirs()) {
    if (!existsSync(d)) continue;
    collectJsonl(d, out);
  }
  return out;
}

export function harvestOnce(): number {
  const state = loadIngestState();
  let added = 0;
  const files = [...inboxFiles(), ...cursorTranscriptFiles(), ...extraFiles()];
  const seen = new Set<string>();
  for (const abs of files) {
    if (seen.has(abs)) continue;
    seen.add(abs);
    const inCursor = /\/\.cursor\/projects\/[^/]+\/agent-transcripts\/.+\.jsonl$/i.test(abs.replace(/\\/g, "/"));
    try {
      const result = ingestFile(
        abs,
        state,
        inCursor
          ? {
              forceCursor: true,
              cursorDefaults: { provider: "cursor", agent: "cursor-agent", sourcePath: abs },
            }
          : undefined,
      );
      added += result.events ?? 0;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`harvest error ${abs}: ${msg}`);
    }
  }
  return added;
}
