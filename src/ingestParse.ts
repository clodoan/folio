import type { LedgerEvent } from "./schema";
import { LedgerEventSchema } from "./schema";
import { cursorTranscriptToEvents, looksLikeClaudeOrCursorLine } from "./adapters/cursorTranscript";
import {
  grokTranscriptToEvents,
  looksLikeGrokRecord,
  type GrokAdapterDefaults,
} from "./adapters/grokTui";
import type { TranscriptFormat } from "./agents";

export type IngestParseOpts = {
  format?: TranscriptFormat;
  defaults?: GrokAdapterDefaults;
};

const firstJsonValue = (text: string): unknown | undefined => {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("[")) {
    try {
      const arr = JSON.parse(trimmed) as unknown;
      if (Array.isArray(arr) && arr.length) return arr[0];
    } catch {
    }
  }
  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
    }
  }
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      return JSON.parse(t) as unknown;
    } catch {
      return undefined;
    }
  }
  return undefined;
};

const isLedgerLike = (raw: unknown): boolean => LedgerEventSchema.safeParse(raw).success;

export const looksLikeCursorTranscript = (text: string): boolean => {
  const first = firstJsonValue(text);
  if (first === undefined) return false;
  if (isLedgerLike(first)) return false;
  return looksLikeClaudeOrCursorLine(first);
};

export const looksLikeGrokTranscript = (text: string): boolean => {
  const first = firstJsonValue(text);
  if (first === undefined) return false;
  if (isLedgerLike(first)) return false;
  return looksLikeGrokRecord(first);
};

const recordsFromText = (text: string): unknown[] => {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("{") && !trimmed.includes("\n")) {
    try {
      return [JSON.parse(trimmed) as unknown];
    } catch {
    }
  }
  if (trimmed.startsWith("[")) {
    try {
      const arr = JSON.parse(trimmed) as unknown;
      if (Array.isArray(arr)) return arr;
    } catch {
    }
  }
  const out: unknown[] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      out.push(JSON.parse(t) as unknown);
    } catch {
    }
  }
  return out;
};

const resolveFormat = (opts?: IngestParseOpts): TranscriptFormat => opts?.format ?? "auto";

export const parseIngestText = (
  text: string,
  opts?: IngestParseOpts,
): {
  mode: "transcript" | "grok" | "ledger";
  events: LedgerEvent[];
} => {
  const defaults = opts?.defaults;
  const format = resolveFormat(opts);
  if (format === "grok" || (format === "auto" && looksLikeGrokTranscript(text))) {
    return {
      mode: "grok",
      events: grokTranscriptToEvents(text, defaults),
    };
  }
  if (format === "transcript" || looksLikeCursorTranscript(text)) {
    return {
      mode: "transcript",
      events: cursorTranscriptToEvents(text, defaults),
    };
  }
  const events: LedgerEvent[] = [];
  for (const raw of recordsFromText(text)) {
    const parsed = LedgerEventSchema.safeParse(raw);
    if (parsed.success) events.push(parsed.data);
  }
  return { mode: "ledger", events };
};
