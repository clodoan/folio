import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { INBOX_DIR } from "./paths.ts";

export type WatchSpec = {
  root: string;
  label: string;
  provider?: string;
  accept: (absPath: string) => boolean;
};

const SECRET_NAME = /^(auth\.json|.*cookie.*|.*secret.*|.*token.*)$/i;

export function isSecretPath(absPath: string): boolean {
  const base = basename(absPath);
  if (SECRET_NAME.test(base)) return true;
  const lower = absPath.replace(/\\/g, "/").toLowerCase();
  if (lower.endsWith("/auth.json")) return true;
  if (lower.includes("/cookies")) return true;
  return false;
}

export function isJsonlOrJson(absPath: string): boolean {
  const lower = absPath.toLowerCase();
  return lower.endsWith(".jsonl") || lower.endsWith(".json");
}

function dirIfExists(p: string): string | null {
  try {
    if (existsSync(p) && statSync(p).isDirectory()) return p;
  } catch {
    /* skip */
  }
  return null;
}

/** Allowlist: inbox plus Cursor project agent-transcripts jsonl */
export function resolveWatchSpecs(): WatchSpec[] {
  const specs: WatchSpec[] = [
    {
      root: INBOX_DIR,
      label: "inbox",
      accept: (abs) => isJsonlOrJson(abs) && !isSecretPath(abs),
    },
  ];
  const projects = dirIfExists(join(homedir(), ".cursor/projects"));
  if (projects) {
    specs.push({
      root: projects,
      label: "cursor agent-transcripts",
      provider: "cursor",
      accept: (abs) => {
        const n = abs.replace(/\\/g, "/");
        return n.includes("/agent-transcripts/") && n.endsWith(".jsonl") && !isSecretPath(abs);
      },
    });
  }
  return specs;
}
