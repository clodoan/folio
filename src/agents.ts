export type TranscriptFormat = "auto" | "transcript" | "grok";

export type AgentPick = "jsonl" | "grok-session" | "cursor-transcript";

export type AgentKind = {
  id: string;
  label: string;
  homeDirs: string[];
  format: TranscriptFormat;
  pick: AgentPick;
  pathNeedles?: string[];
};

export const AGENT_KINDS: readonly AgentKind[] = [
  {
    id: "grok",
    label: "Grok",
    homeDirs: [".grok/sessions"],
    format: "grok",
    pick: "grok-session",
    pathNeedles: ["grok-bot", "grok.bot", "grok-tui", "xai-grok-pager", "grok-pager"],
  },
  {
    id: "claude",
    label: "Claude",
    homeDirs: [".claude/projects", ".claude/sessions"],
    format: "transcript",
    pick: "jsonl",
    pathNeedles: ["claude-code"],
  },
  {
    id: "cursor",
    label: "Cursor",
    homeDirs: [".cursor/projects"],
    format: "transcript",
    pick: "cursor-transcript",
    pathNeedles: ["/agentstores/", "cursor-agent-worker", "cursor-cloud", "agent-transcripts"],
  },
  {
    id: "codex",
    label: "Codex",
    homeDirs: [".codex/sessions"],
    format: "auto",
    pick: "jsonl",
  },
  {
    id: "gemini",
    label: "Gemini",
    homeDirs: [".gemini/sessions"],
    format: "auto",
    pick: "jsonl",
  },
  {
    id: "opencode",
    label: "OpenCode",
    homeDirs: [".opencode/sessions", ".local/share/opencode/sessions"],
    format: "auto",
    pick: "jsonl",
  },
  {
    id: "continue",
    label: "Continue",
    homeDirs: [".continue/sessions"],
    format: "auto",
    pick: "jsonl",
  },
  {
    id: "goose",
    label: "Goose",
    homeDirs: [".goose/sessions", ".config/goose/sessions"],
    format: "auto",
    pick: "jsonl",
  },
  {
    id: "amp",
    label: "Amp",
    homeDirs: [".amp/sessions"],
    format: "auto",
    pick: "jsonl",
  },
  {
    id: "crush",
    label: "Crush",
    homeDirs: [".crush/sessions", ".config/crush/sessions"],
    format: "auto",
    pick: "jsonl",
  },
  {
    id: "cline",
    label: "Cline",
    homeDirs: [".cline/sessions"],
    format: "auto",
    pick: "jsonl",
  },
  {
    id: "copilot",
    label: "Copilot",
    homeDirs: [".copilot/sessions"],
    format: "auto",
    pick: "jsonl",
  },
  {
    id: "factory",
    label: "Factory",
    homeDirs: [".factory/sessions"],
    format: "auto",
    pick: "jsonl",
  },
  {
    id: "aider",
    label: "Aider",
    homeDirs: [".aider-desk/sessions"],
    format: "auto",
    pick: "jsonl",
  },
];

const HOME_SESSION = /\/\.([a-z0-9_-]+)\/(sessions|projects|conversations|agent-transcripts|chats)(?:\/|$)/i;

export const kindForPath = (absPath: string): AgentKind | undefined => {
  const p = absPath.replace(/\\/g, "/").toLowerCase();
  return AGENT_KINDS.find((k) => {
    const inHome = k.homeDirs.some(
      (dir) => p.includes(`/${dir.toLowerCase()}/`) || p.endsWith(`/${dir.toLowerCase()}`),
    );
    if (inHome) return true;
    return (k.pathNeedles ?? []).some((n) => p.includes(n.toLowerCase()));
  });
};

export const inferProviderFromPath = (absPath: string): string => {
  const kind = kindForPath(absPath);
  if (kind) return kind.id;
  const p = absPath.replace(/\\/g, "/").toLowerCase();
  const m = p.match(HOME_SESSION);
  if (m?.[1]) return m[1];
  return "local";
};

export const inferAgentFromPath = (absPath: string, provider: string): string => {
  const n = absPath.replace(/\\/g, "/");
  if (n.includes("/subagents/")) return `${provider}-subagent`;
  return provider;
};

export const sessionIdFromPath = (absPath: string): string | undefined => {
  const parts = absPath.replace(/\\/g, "/").split("/");
  const file = parts[parts.length - 1] ?? "";
  const stem = file.replace(/\.(jsonl|json)$/i, "");
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuid.test(stem)) return stem;
  const parent = parts[parts.length - 2] ?? "";
  if (uuid.test(parent)) return parent;
  return undefined;
};

export const formatHintForPath = (absPath: string): TranscriptFormat => {
  const kind = kindForPath(absPath);
  if (kind) return kind.format;
  const provider = inferProviderFromPath(absPath);
  if (provider === "grok") return "grok";
  if (provider === "cursor" || provider === "claude") return "transcript";
  return "auto";
};
