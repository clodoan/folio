import type { LedgerEvent } from "./schema";
import { LedgerEventSchema, parseEvent } from "./schema";
import {
  cursorTranscriptToEvents,
  looksLikeClaudeOrCursorLine,
  type CursorAdapterDefaults,
} from "./adapters/cursorTranscript";

function firstJsonValue(text: string): unknown | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("[")) {
    try {
      const arr = JSON.parse(trimmed) as unknown;
      if (Array.isArray(arr) && arr.length) return arr[0];
    } catch {
      /* fall through */
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
}

function isLedgerLike(raw: unknown): boolean {
  return LedgerEventSchema.safeParse(raw).success;
}

export function looksLikeCursorTranscript(text: string): boolean {
  const first = firstJsonValue(text);
  if (first === undefined) return false;
  if (isLedgerLike(first)) return false;
  return looksLikeClaudeOrCursorLine(first);
}

function recordsFromText(text: string): unknown[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("{") && !trimmed.includes("\n")) {
    try {
      return [JSON.parse(trimmed) as unknown];
    } catch {
      /* jsonl fallback */
    }
  }
  if (trimmed.startsWith("[")) {
    try {
      const arr = JSON.parse(trimmed) as unknown;
      if (Array.isArray(arr)) return arr;
    } catch {
      /* jsonl fallback */
    }
  }
  const out: unknown[] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      out.push(JSON.parse(t) as unknown);
    } catch {
      /* skip junk ledger lines */
    }
  }
  return out;
}

export function parseIngestText(
  text: string,
  opts?: { forceCursor?: boolean; cursorDefaults?: CursorAdapterDefaults },
): {
  mode: "cursor" | "ledger";
  events: LedgerEvent[];
} {
  if (opts?.forceCursor || looksLikeCursorTranscript(text)) {
    return {
      mode: "cursor",
      events: cursorTranscriptToEvents(text, opts?.cursorDefaults),
    };
  }
  const events: LedgerEvent[] = [];
  for (const raw of recordsFromText(text)) {
    const parsed = LedgerEventSchema.safeParse(raw);
    if (parsed.success) events.push(parsed.data);
    else {
      try {
        events.push(parseEvent(raw));
      } catch {
        /* skip junk */
      }
    }
  }
  return { mode: "ledger", events };
}
