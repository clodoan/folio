import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname } from "node:path";
import type { LedgerEvent } from "../src/schema.ts";
import { parseIngestText, type IngestParseOpts } from "../src/ingestParse.ts";
import { DATA_DAYS, INGEST_STATE } from "./paths.ts";
import { bus } from "./bus.ts";
import { isSecretPath } from "./watchTargets.ts";

export type FileCursor = {
  offset: number;
  mtimeMs: number;
  size: number;
};

export type IngestState = {
  files: Record<string, FileCursor>;
};

export function loadIngestState(): IngestState {
  try {
    const raw = JSON.parse(readFileSync(INGEST_STATE, "utf8")) as IngestState;
    if (raw && typeof raw === "object" && raw.files && typeof raw.files === "object") {
      const files: Record<string, FileCursor> = {};
      for (const [k, v] of Object.entries(raw.files)) {
        if (!v || typeof v !== "object") continue;
        const o = v as Partial<FileCursor>;
        files[k] = {
          offset: typeof o.offset === "number" ? o.offset : typeof o.size === "number" ? o.size : 0,
          mtimeMs: typeof o.mtimeMs === "number" ? o.mtimeMs : 0,
          size: typeof o.size === "number" ? o.size : 0,
        };
      }
      return { files };
    }
  } catch {
    /* missing or corrupt */
  }
  return { files: {} };
}

export function saveIngestState(state: IngestState): void {
  mkdirSync(dirname(INGEST_STATE), { recursive: true });
  writeFileSync(INGEST_STATE, JSON.stringify(state, null, 2) + "\n", "utf8");
}

export function isIngestiblePath(path: string): boolean {
  const ext = extname(path).toLowerCase();
  return ext === ".jsonl" || ext === ".json";
}

export function loadDayIds(day: string): Set<string> {
  const p = `${DATA_DAYS}/${day}.jsonl`;
  const ids = new Set<string>();
  if (!existsSync(p)) return ids;
  const text = readFileSync(p, "utf8");
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      const o = JSON.parse(t) as { id?: unknown };
      if (typeof o.id === "string") ids.add(o.id);
    } catch {
    }
  }
  return ids;
}

export function appendEvents(events: LedgerEvent[]): Map<string, number> {
  const byDay = new Map<string, LedgerEvent[]>();
  for (const e of events) {
    const list = byDay.get(e.day) ?? [];
    list.push(e);
    byDay.set(e.day, list);
  }
  mkdirSync(DATA_DAYS, { recursive: true });
  const counts = new Map<string, number>();
  for (const [day, dayEvents] of byDay) {
    const existing = loadDayIds(day);
    const fresh = dayEvents.filter((ev) => !existing.has(ev.id));
    if (fresh.length === 0) {
      counts.set(day, 0);
      continue;
    }
    const line = fresh.map((ev) => JSON.stringify(ev)).join("\n") + "\n";
    appendFileSync(`${DATA_DAYS}/${day}.jsonl`, line, "utf8");
    counts.set(day, fresh.length);
  }
  return counts;
}

export type IngestResult = {
  skipped: boolean;
  reason?: string;
  mode?: "transcript" | "grok" | "ledger";
  events?: number;
  days?: string[];
};

function readNewBytes(absPath: string, offset: number, size: number): { text: string; consumed: number } | null {
  const len = size - offset;
  if (len <= 0) return { text: "", consumed: 0 };
  const fd = openSync(absPath, "r");
  try {
    const buf = Buffer.alloc(len);
    const n = readSync(fd, buf, 0, len, offset);
    const slice = buf.subarray(0, n);
    const nl = slice.lastIndexOf(0x0a);
    if (nl === -1) return null;
    const chunk = slice.subarray(0, nl + 1);
    return { text: chunk.toString("utf8"), consumed: chunk.length };
  } finally {
    closeSync(fd);
  }
}

export function ingestFile(
  absPath: string,
  state: IngestState,
  opts?: IngestParseOpts,
): IngestResult {
  if (isSecretPath(absPath)) {
    return { skipped: true, reason: "secret" };
  }
  if (!isIngestiblePath(absPath)) {
    return { skipped: true, reason: "not-json" };
  }
  let st;
  try {
    st = statSync(absPath);
  } catch {
    return { skipped: true, reason: "missing" };
  }
  if (!st.isFile()) return { skipped: true, reason: "not-file" };

  const prev = state.files[absPath];
  let offset = 0;
  if (prev) {
    if (st.size < prev.size) {
      offset = 0;
    } else if (st.size === prev.size && st.mtimeMs !== prev.mtimeMs) {
      offset = 0;
    } else {
      offset = prev.offset ?? 0;
      if (offset > st.size) offset = 0;
    }
  }

  if (prev && offset === st.size && prev.mtimeMs === st.mtimeMs && prev.size === st.size) {
    return { skipped: true, reason: "already-processed" };
  }

  if (st.size === 0) {
    state.files[absPath] = { offset: 0, mtimeMs: st.mtimeMs, size: 0 };
    saveIngestState(state);
    return { skipped: true, reason: "empty" };
  }

  const chunk = readNewBytes(absPath, offset, st.size);
  if (chunk === null) {
    return { skipped: true, reason: "incomplete-line" };
  }
  if (!chunk.text.trim()) {
    state.files[absPath] = { offset: offset + chunk.consumed, mtimeMs: st.mtimeMs, size: st.size };
    saveIngestState(state);
    return { skipped: true, reason: "empty" };
  }

  const parsed = parseIngestText(chunk.text, {
    format: opts?.format,
    defaults: opts?.defaults,
  });
  const counts = appendEvents(parsed.events);
  const added = [...counts.values()].reduce((a, b) => a + b, 0);
  state.files[absPath] = {
    offset: offset + chunk.consumed,
    mtimeMs: st.mtimeMs,
    size: st.size,
  };
  saveIngestState(state);
  const days = [...counts.entries()].filter(([, n]) => n > 0).map(([d]) => d).sort();
  console.log(
    `ingest ${basename(absPath)} mode=${parsed.mode} parsed=${parsed.events.length} added=${added} days=${days.join(",") || "-"}`,
  );
  if (added > 0) {
    bus.note({ file: absPath, events: added, days, mode: parsed.mode });
  }
  return { skipped: false, mode: parsed.mode, events: added, days };
}
