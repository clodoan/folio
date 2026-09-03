import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(__dirname, "..");
export const DATA_DAYS = resolve(ROOT, "data/days");
export const INBOX_DIR = resolve(ROOT, "inbox");
export const INGEST_STATE = resolve(ROOT, "data/.ingest-state.json");
export const WATCH_CONFIG = resolve(ROOT, "data/watch.json");
export const LETTERS_DIR = resolve(ROOT, "letters");

export function deliveredFlag(day: string): string {
  return join(ROOT, "data", `.folio-delivered-${day}`);
}
