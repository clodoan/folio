/** Known ingest providers. Chips always offer these plus any extra seen in the log. */
export const KNOWN_PROVIDERS = [
  "cursor",
  "cursor-cloud",
  "grok-tui",
  "grok-bot",
] as const;

export type KnownProvider = (typeof KNOWN_PROVIDERS)[number];

export function mergeProviders(seen: string[]): string[] {
  const set = new Set<string>([...KNOWN_PROVIDERS, ...seen]);
  return [...set].sort();
}

export function inferProviderFromPath(absPath: string): string {
  const p = absPath.replace(/\\/g, "/").toLowerCase();
  if (p.includes("/agentstores/") || p.includes("cursor-agent-worker") || p.includes("cursor-cloud")) {
    return "cursor-cloud";
  }
  if (p.includes("agent-transcripts") || p.includes("/.cursor/projects/")) {
    return "cursor";
  }
  if (p.includes("grok-tui") || p.includes("xai-grok-pager") || p.includes("grok-pager")) {
    return "grok-tui";
  }
  if (p.includes("grok-bot") || /grok.bot/.test(p)) return "grok-bot";
  return "cursor";
}

export function inferAgentFromPath(absPath: string, provider: string): string {
  if (provider === "cursor-cloud") return "cursor-cloud-agent";
  if (provider === "grok-tui") return "grok-tui";
  if (provider === "grok-bot") return "grok-bot";
  if (absPath.replace(/\\/g, "/").includes("/subagents/")) return "cursor-subagent";
  return "cursor-agent";
}

export function sessionIdFromPath(absPath: string): string | undefined {
  const parts = absPath.replace(/\\/g, "/").split("/");
  const file = parts[parts.length - 1] ?? "";
  const stem = file.replace(/\.(jsonl|json)$/i, "");
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuid.test(stem)) return stem;
  const parent = parts[parts.length - 2] ?? "";
  if (uuid.test(parent)) return parent;
  return undefined;
}
