import type { EventRole, LedgerEvent } from "../schema";
import { DEFAULT_TIMEZONE, dayInTz } from "../schema";
import {
  asRecord,
  capPayload,
  previewText,
  sessionIdFromDefaults,
  type AdapterDefaults,
} from "./shared";

export type CursorAdapterDefaults = AdapterDefaults;

type ContentBlock = {
  type?: string;
  text?: string;
  name?: string;
  id?: string;
  input?: unknown;
  content?: unknown;
  tool_use_id?: string;
};

function pickTs(raw: Record<string, unknown>, fallbackIso: string): string {
  const keys = ["ts", "timestamp", "createdAt", "created_at", "time"];
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === "string" && v.trim()) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
      return v;
    }
    if (typeof v === "number" && Number.isFinite(v)) {
      const ms = v < 1e12 ? v * 1000 : v;
      const d = new Date(ms);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
  }
  const msg = asRecord(raw.message);
  if (msg) {
    const nested = pickTs(msg, "");
    if (nested) return nested;
  }
  return fallbackIso;
}

function blocksFromContent(content: unknown): ContentBlock[] {
  if (typeof content === "string") return [{ type: "text", text: content }];
  if (!Array.isArray(content)) return [];
  const out: ContentBlock[] = [];
  for (const item of content) {
    const r = asRecord(item);
    if (r) out.push(r as ContentBlock);
    else if (typeof item === "string") out.push({ type: "text", text: item });
  }
  return out;
}

function extractContent(raw: Record<string, unknown>): unknown {
  if (raw.content !== undefined) return raw.content;
  if (typeof raw.text === "string") return raw.text;
  const msg = asRecord(raw.message);
  if (msg) {
    if (msg.content !== undefined) return msg.content;
    if (typeof msg.text === "string") return msg.text;
  }
  return undefined;
}

function textFromBlocks(blocks: ContentBlock[]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    if ((b.type === "text" || !b.type) && typeof b.text === "string") {
      parts.push(b.text);
    }
  }
  return parts.join("\n").trim();
}

function mapRole(role: string): EventRole {
  if (role === "assistant" || role === "agent" || role === "bot") return "agent";
  if (role === "system") return "system";
  return "user";
}

function stableId(parts: string[]): string {
  const raw = parts.join("|").replace(/[^a-zA-Z0-9._:-]/g, "").slice(0, 96);
  return `cur_${raw || "line"}`.slice(0, 80);
}

function lineId(raw: Record<string, unknown>, fallback: string): string {
  for (const k of ["uuid", "bubbleId", "id", "messageId"]) {
    const v = raw[k];
    if (typeof v === "string" && v.trim()) return `cur_${v.replace(/[^a-zA-Z0-9._:-]/g, "").slice(0, 72)}`;
  }
  const msg = asRecord(raw.message);
  if (msg) {
    const inner = lineId(msg, "");
    if (inner && inner !== "cur_") return inner;
  }
  return fallback;
}

function isToolLine(raw: Record<string, unknown>): boolean {
  return raw.type === "tool" || raw.type === "tool_use" || raw.type === "tool_call";
}

function isMessageish(raw: Record<string, unknown>): boolean {
  const role = raw.role ?? asRecord(raw.message)?.role ?? (typeof raw.type === "string" ? raw.type : undefined);
  if (typeof role === "string" && ["user", "assistant", "system", "agent"].includes(role)) {
    return true;
  }
  return false;
}

const SKIP_TYPES = new Set([
  "progress",
  "queue-operation",
  "file-history-snapshot",
  "summary",
  "stream_event",
  "heartbeat",
]);

export function cursorTranscriptToEvents(
  text: string,
  defaults?: CursorAdapterDefaults,
): LedgerEvent[] {
  const providerDefault = defaults?.provider ?? "cursor";
  const agentDefault = defaults?.agent ?? "cursor-agent";
  const sessionDefault = sessionIdFromDefaults(defaults);
  const timeZone = defaults?.timeZone ?? DEFAULT_TIMEZONE;
  const events: LedgerEvent[] = [];
  const nowIso = new Date().toISOString();

  const lines = text.split("\n");
  let idx = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    idx += 1;
    let rawUnknown: unknown;
    try {
      rawUnknown = JSON.parse(trimmed);
    } catch {
      continue;
    }
    const raw = asRecord(rawUnknown);
    if (!raw) continue;
    if (typeof raw.type === "string" && SKIP_TYPES.has(raw.type)) continue;

    const sessionId =
      (typeof raw.sessionId === "string" && raw.sessionId) ||
      (typeof raw.session_id === "string" && raw.session_id) ||
      sessionDefault;
    const provider =
      (typeof raw.provider === "string" && raw.provider) || providerDefault;
    const agent =
      (typeof raw.agent === "string" && raw.agent) ||
      (typeof raw.model === "string" && raw.model) ||
      agentDefault;
    const ts = pickTs(raw, nowIso);
    const day = dayInTz(ts, timeZone);

    if (isToolLine(raw)) {
      const name =
        (typeof raw.name === "string" && raw.name) ||
        (typeof raw.tool === "string" && raw.tool) ||
        "tool";
      events.push({
        id: lineId(raw, stableId([sessionId, ts, "tool", name, String(idx)])),
        ts,
        day,
        provider,
        agent,
        sessionId,
        kind: "tool",
        summary: previewText(`Tool: ${name}`),
        payload: capPayload({ name, input: raw.input, output: raw.output ?? raw.result }),
      });
      continue;
    }

    if (raw.type === "tool_result" || raw.type === "user" && raw.tool_use_id) {
      events.push({
        id: lineId(raw, stableId([sessionId, ts, "tool_result", String(idx)])),
        ts,
        day,
        provider,
        agent,
        sessionId,
        kind: "tool",
        summary: previewText("Tool result"),
        payload: capPayload({
          tool_use_id: raw.tool_use_id ?? raw.toolUseId,
        }),
      });
      continue;
    }

    if (!isMessageish(raw) && raw.type !== "user" && raw.type !== "assistant") {
      continue;
    }

    const roleRaw =
      (typeof raw.role === "string" && raw.role) ||
      (typeof asRecord(raw.message)?.role === "string" && (asRecord(raw.message)!.role as string)) ||
      (typeof raw.type === "string" && raw.type) ||
      "assistant";
    const role = mapRole(roleRaw);
    const blocks = blocksFromContent(extractContent(raw));
    const textBody = textFromBlocks(blocks) || (typeof raw.text === "string" ? raw.text : "");
    const baseId = lineId(raw, stableId([sessionId, ts, role, String(idx)]));

    if (textBody) {
      events.push({
        id: `${baseId}_msg`.slice(0, 80),
        ts,
        day,
        provider,
        agent,
        sessionId,
        kind: "message",
        role,
        summary: previewText(textBody),
        payload: capPayload({ text: textBody }),
      });
    }

    let toolN = 0;
    for (const b of blocks) {
      if (b.type === "tool_use" || b.type === "tool_call" || b.type === "tool") {
        toolN += 1;
        const name = b.name ?? "tool";
        events.push({
          id: `${baseId}_t${toolN}`.slice(0, 80),
          ts,
          day,
          provider,
          agent,
          sessionId,
          kind: "tool",
          summary: previewText(`Tool: ${name}`),
          payload: capPayload({ name, id: b.id, input: b.input }),
        });
      } else if (b.type === "tool_result") {
        toolN += 1;
        events.push({
          id: `${baseId}_tr${toolN}`.slice(0, 80),
          ts,
          day,
          provider,
          agent,
          sessionId,
          kind: "tool",
          summary: previewText("Tool result"),
          payload: capPayload({ tool_use_id: b.tool_use_id }),
        });
      }
    }
  }

  return events;
}

export function looksLikeClaudeOrCursorLine(raw: unknown): boolean {
  const o = asRecord(raw);
  if (!o) return false;
  if (o.type === "tool" && typeof o.sessionId === "string") return true;
  if (typeof o.role === "string" && typeof o.text === "string" && typeof o.sessionId === "string") {
    return true;
  }
  const role = o.role ?? o.type;
  if (typeof role === "string" && ["user", "assistant", "system"].includes(role)) {
    if (o.message !== undefined || o.content !== undefined || o.text !== undefined) return true;
  }
  if (o.type === "tool_use" || o.type === "tool_result" || o.type === "tool_call") return true;
  return false;
}
