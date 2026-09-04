import { copyFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FOLIO_HOME } from "./folio-config.ts";

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(here, "..");
export const DATA_DAYS = join(FOLIO_HOME, "days");
export const INGEST_STATE = join(FOLIO_HOME, "ingest-state.json");
export const INGEST_LOCK = join(FOLIO_HOME, "ingest-state.lock");
export const INBOX_DIR = resolve(ROOT, "inbox");
export const LETTERS_DIR = resolve(ROOT, "letters");

export const deliveredFlag = (day: string): string => join(FOLIO_HOME, "delivered", day);

export const isDelivered = (day: string): boolean => existsSync(deliveredFlag(day));

export const markDelivered = (day: string): void => {
  const p = deliveredFlag(day);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, "1\n", "utf8");
};

// After delivery the day scratch has served its purpose. Drop that day's
// JSONL and older ones so transcript bodies do not pile under ~/.folio.
export const purgeDayScratch = (day: string): string[] => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return [];
  let names: string[];
  try {
    names = readdirSync(DATA_DAYS);
  } catch {
    return [];
  }
  const removed: string[] = [];
  for (const name of names) {
    const m = /^(\d{4}-\d{2}-\d{2})\.jsonl$/.exec(name);
    if (!m || m[1] > day) continue;
    try {
      unlinkSync(join(DATA_DAYS, name));
      removed.push(m[1]);
    } catch {
    }
  }
  return removed.sort();
};

export const ensureFolioData = (): void => {
  mkdirSync(DATA_DAYS, { recursive: true });
  mkdirSync(join(FOLIO_HOME, "delivered"), { recursive: true });
  const oldDays = join(ROOT, "data/days");
  if (existsSync(oldDays) && readdirSync(DATA_DAYS).length === 0) {
    for (const name of readdirSync(oldDays)) {
      if (!name.endsWith(".jsonl")) continue;
      copyFileSync(join(oldDays, name), join(DATA_DAYS, name));
    }
  }
  const oldState = join(ROOT, "data/.ingest-state.json");
  if (existsSync(oldState) && !existsSync(INGEST_STATE)) {
    copyFileSync(oldState, INGEST_STATE);
  }
  const oldData = join(ROOT, "data");
  if (!existsSync(oldData)) return;
  for (const name of readdirSync(oldData)) {
    const m = /^\.folio-delivered-(.+)$/.exec(name);
    if (!m) continue;
    const dest = deliveredFlag(m[1]);
    if (!existsSync(dest)) copyFileSync(join(oldData, name), dest);
  }
};
