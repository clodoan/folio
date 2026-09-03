import { sessionIdFromPath } from "../agents";

export const MAX_PAYLOAD_CHARS = 2000;

export type AdapterDefaults = {
  provider?: string;
  agent?: string;
  sessionId?: string;
  sourcePath?: string;
  timeZone?: string;
};

export const asRecord = (raw: unknown): Record<string, unknown> | null => {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
};

export const previewText = (text: string, n = 120): string => {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1)}…`;
};

export const capPayload = (value: unknown): unknown => {
  try {
    const s = JSON.stringify(value);
    if (s === undefined) return undefined;
    if (s.length <= MAX_PAYLOAD_CHARS) return value;
    return {
      truncated: true,
      chars: s.length,
      preview: s.slice(0, MAX_PAYLOAD_CHARS),
    };
  } catch {
    return { truncated: true, preview: String(value).slice(0, 200) };
  }
};

export const sessionIdFromDefaults = (defaults?: AdapterDefaults): string =>
  defaults?.sessionId ?? sessionIdFromPath(defaults?.sourcePath ?? "") ?? "unknown";
