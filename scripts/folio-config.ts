import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type FolioConfig = {
  name: string;
  timezone: string;
  watch: string[];
};

export const FOLIO_HOME = join(homedir(), ".folio");
export const FOLIO_CONFIG_PATH = join(FOLIO_HOME, "config.json");
export const DEFAULT_TIMEZONE = "America/Los_Angeles";

export function defaultName(): string {
  const env = process.env.FOLIO_NAME?.trim();
  if (env) return env;
  const user = (process.env.USER || process.env.USERNAME || "").trim();
  if (!user) return "you";
  return user.charAt(0).toUpperCase() + user.slice(1);
}

export function loadFolioConfig(): FolioConfig {
  const fallback: FolioConfig = {
    name: defaultName(),
    timezone: DEFAULT_TIMEZONE,
    watch: [],
  };
  try {
    if (!existsSync(FOLIO_CONFIG_PATH)) return fallback;
    const raw = JSON.parse(readFileSync(FOLIO_CONFIG_PATH, "utf8")) as Partial<FolioConfig>;
    const watch = Array.isArray(raw.watch)
      ? raw.watch.filter((p): p is string => typeof p === "string" && p.trim().length > 0)
      : [];
    return {
      name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : fallback.name,
      timezone:
        typeof raw.timezone === "string" && raw.timezone.trim() ? raw.timezone.trim() : fallback.timezone,
      watch,
    };
  } catch {
    return fallback;
  }
}

export function writeFolioConfig(partial?: Partial<FolioConfig>): FolioConfig {
  const prev = loadFolioConfig();
  const next: FolioConfig = {
    name: partial?.name?.trim() || prev.name || defaultName(),
    timezone: partial?.timezone?.trim() || prev.timezone || DEFAULT_TIMEZONE,
    watch: partial?.watch ?? prev.watch,
  };
  mkdirSync(FOLIO_HOME, { recursive: true });
  writeFileSync(FOLIO_CONFIG_PATH, JSON.stringify(next, null, 2) + "\n", "utf8");
  return next;
}

export function expandUserPath(p: string): string {
  const t = p.trim();
  if (t === "~") return homedir();
  if (t.startsWith("~/")) return join(homedir(), t.slice(2));
  return t;
}

export function extraWatchFromConfig(): string[] {
  const cfg = loadFolioConfig();
  return cfg.watch.map(expandUserPath);
}
