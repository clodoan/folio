import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(__dirname, "..");
export const DATA_DAYS = resolve(ROOT, "data/days");
export const PUBLIC_DAYS = resolve(ROOT, "public/data/days");
export const DATA_SUMMARIES = resolve(ROOT, "data/summaries");
export const PUBLIC_SUMMARIES = resolve(ROOT, "public/data/summaries");
export const INBOX_DIR = resolve(ROOT, "inbox");
export const INGEST_STATE = resolve(ROOT, "data/.ingest-state.json");
export const WATCH_CONFIG = resolve(ROOT, "data/watch.json");
export const DIST_DIR = resolve(ROOT, "dist");
export const PUBLIC_DIR = resolve(ROOT, "public");
export const LETTERS_DIR = resolve(ROOT, "letters");
export const DEFAULT_PORT = 4173;
export const TZ = "America/Los_Angeles";

export function deliveredFlag(day: string): string {
  return join(ROOT, "data", `.folio-delivered-${day}`);
}
