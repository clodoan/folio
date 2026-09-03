import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import {
  AGENT_KINDS,
  formatHintForPath,
  inferAgentFromPath,
  inferProviderFromPath,
  sessionIdFromPath,
  type AgentKind,
  type TranscriptFormat,
} from "../src/agents.ts";
import type { GrokAdapterDefaults } from "../src/adapters/grokTui.ts";
import { extraWatchFromConfig, loadFolioConfig } from "./folio-config.ts";
import { INBOX_DIR } from "./paths.ts";

export type WatchSpec = {
  root: string;
  label: string;
  provider?: string;
  accept: (absPath: string) => boolean;
};

export type IngestFileOpts = {
  format?: TranscriptFormat;
  defaults?: GrokAdapterDefaults;
};

const SECRET_NAME = /^(auth\.json|.*cookie.*|.*secret.*|.*token.*|.*credentials.*)$/i;
const GROK_SESSION_FILE = /^(updates|events|chat_history)\.jsonl$|^summary\.json$/i;
export const isSecretPath = (absPath: string): boolean => {
  const base = basename(absPath);
  if (SECRET_NAME.test(base)) return true;
  const lower = absPath.replace(/\\/g, "/").toLowerCase();
  if (lower.endsWith("/auth.json")) return true;
  if (lower.includes("/cookies")) return true;
  return false;
};

export const isJsonlOrJson = (absPath: string): boolean => {
  const lower = absPath.toLowerCase();
  return lower.endsWith(".jsonl") || lower.endsWith(".json");
};

const dirIfExists = (p: string): string | null => {
  try {
    if (existsSync(p) && statSync(p).isDirectory()) return p;
  } catch {
  }
  return null;
};

const siblingExists = (absPath: string, name: string): boolean => {
  try {
    return existsSync(join(dirname(absPath), name));
  } catch {
    return false;
  }
};

export const grokHome = (): string => {
  const env = process.env.GROK_HOME?.trim();
  if (env) return env;
  return join(homedir(), ".grok");
};

const expandHomeDir = (rel: string): string => {
  if (rel.startsWith(".grok/")) {
    return join(grokHome(), rel.slice(".grok/".length));
  }
  return join(homedir(), rel);
};

export const isGrokSessionFile = (absPath: string): boolean => {
  if (isSecretPath(absPath)) return false;
  const base = basename(absPath);
  if (!GROK_SESSION_FILE.test(base)) return false;
  if (base === "updates.jsonl") return true;
  if (siblingExists(absPath, "updates.jsonl")) return false;
  if (base === "events.jsonl" || base === "chat_history.jsonl") return true;
  return !siblingExists(absPath, "events.jsonl") && !siblingExists(absPath, "chat_history.jsonl");
};

export const isCursorTranscriptFile = (absPath: string): boolean => {
  const n = absPath.replace(/\\/g, "/");
  return /\/agent-transcripts\/.+\.jsonl$/i.test(n) && !isSecretPath(absPath);
};

const acceptForKind = (kind: AgentKind): ((absPath: string) => boolean) => {
  switch (kind.pick) {
    case "grok-session":
      return isGrokSessionFile;
    case "cursor-transcript":
      return isCursorTranscriptFile;
    case "jsonl":
      return (abs) => abs.endsWith(".jsonl") && !isSecretPath(abs);
    default: {
      const _never: never = kind.pick;
      return _never;
    }
  }
};

export const extraWatchRoots = (): string[] => [...new Set(extraWatchFromConfig())];

const grokSpanFromSibling = (absPath: string): Pick<GrokAdapterDefaults, "fallbackStartIso" | "fallbackEndIso"> => {
  const summaryPath = join(dirname(absPath), "summary.json");
  try {
    if (!existsSync(summaryPath)) return {};
    const raw = JSON.parse(readFileSync(summaryPath, "utf8")) as {
      created_at?: unknown;
      last_active_at?: unknown;
      updated_at?: unknown;
    };
    const start = typeof raw.created_at === "string" ? raw.created_at : undefined;
    const end =
      (typeof raw.last_active_at === "string" && raw.last_active_at) ||
      (typeof raw.updated_at === "string" && raw.updated_at) ||
      undefined;
    return {
      fallbackStartIso: start,
      fallbackEndIso: end,
    };
  } catch {
    return {};
  }
};

export const ingestOptionsFor = (absPath: string): IngestFileOpts => {
  const provider = inferProviderFromPath(absPath);
  const agent = inferAgentFromPath(absPath, provider);
  const format = formatHintForPath(absPath);
  const span = format === "grok" ? grokSpanFromSibling(absPath) : {};
  const defaults: GrokAdapterDefaults = {
    provider,
    agent,
    sessionId: sessionIdFromPath(absPath),
    sourcePath: absPath,
    timeZone: loadFolioConfig().timezone,
    ...span,
  };
  return { format, defaults };
};

export const pathUnderRoot = (root: string, absPath: string): boolean => {
  const rn = resolve(root).replace(/\\/g, "/");
  const an = resolve(absPath).replace(/\\/g, "/");
  return an === rn || an.startsWith(`${rn}/`);
};

export const specForPath = (specs: WatchSpec[], absPath: string): WatchSpec | undefined =>
  specs.find((s) => pathUnderRoot(s.root, absPath) && s.accept(absPath));

export const resolveWatchSpecs = (): WatchSpec[] => {
  const specs: WatchSpec[] = [
    {
      root: INBOX_DIR,
      label: "inbox",
      accept: (abs) => isJsonlOrJson(abs) && !isSecretPath(abs) && dirname(abs) === INBOX_DIR,
    },
  ];

  for (const kind of AGENT_KINDS) {
    for (const rel of kind.homeDirs) {
      const root = expandHomeDir(rel);
      if (!dirIfExists(root)) continue;
      specs.push({
        root,
        label: kind.label,
        provider: kind.id,
        accept: acceptForKind(kind),
      });
    }
  }

  for (const root of extraWatchRoots()) {
    if (!dirIfExists(root)) continue;
    specs.push({
      root,
      label: `extra ${root}`,
      accept: (abs) => abs.endsWith(".jsonl") && !isSecretPath(abs),
    });
  }

  return specs;
};
