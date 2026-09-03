import type { EventRole, LedgerEvent } from "../schema";
import { DEFAULT_TIMEZONE, dayInTz } from "../schema";
import {
  asRecord,
  capPayload,
  previewText,
  sessionIdFromDefaults,
  type AdapterDefaults,
} from "./shared";

export type GrokAdapterDefaults = AdapterDefaults & {
  fallbackStartIso?: string;
  fallbackEndIso?: string;
};

type ContentBlock = {
  type?: string;
  text?: string;
  name?: string;
  id?: string;
  input?: unknown;
  content?: unknown;
};

const GROK_EVENT_TYPES = new Set([
  "turn_started",
  "turn_ended",
  "tool_started",
  "tool_completed",
  "phase_changed",
  "loop_started",
  "first_token",
  "permission_requested",
  "permission_resolved",
  "mcp_server_starting",
  "mcp_server_connected",
  "mcp_server_failed",
  "mcp_config_resolved",
  "mcp_init_completed",
]);

const KEEP_EVENTS = new Set([
  "turn_started",
  "turn_ended",
  "tool_started",
  "tool_completed",
]);

const CHUNK_UPDATES = new Set(["user_message_chunk", "agent_message_chunk"]);

export const tsToIso = (value: unknown, fallback: string): string => {
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return fallback;
};

const stableId = (parts: string[]): string => {
  const raw = parts.join("|").replace(/[^a-zA-Z0-9._:-]/g, "").slice(0, 96);
  return `grok_${raw || "line"}`.slice(0, 80);
};

const textFromContent = (content: unknown): string => {
  if (typeof content === "string") return content;
  const rec = asRecord(content);
  if (rec && typeof rec.text === "string") return rec.text;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const item of content) {
    if (typeof item === "string") {
      parts.push(item);
      continue;
    }
    const block = asRecord(item) as ContentBlock | null;
    if (block && typeof block.text === "string") parts.push(block.text);
  }
  return parts.join("\n");
};

const looksLikeGrokUpdate = (raw: unknown): boolean => {
  const o = asRecord(raw);
  if (!o) return false;
  if (o.method !== "session/update") return false;
  return asRecord(o.params) !== null;
};

const looksLikeGrokEvent = (raw: unknown): boolean => {
  const o = asRecord(raw);
  return Boolean(o && typeof o.type === "string" && GROK_EVENT_TYPES.has(o.type));
};

const looksLikeGrokSummary = (raw: unknown): boolean => {
  const o = asRecord(raw);
  if (!o) return false;
  if (typeof o.grok_home === "string") return true;
  if (typeof o.generated_title === "string" && typeof o.created_at === "string") return true;
  if (typeof o.session_summary === "string" && typeof o.current_model_id === "string") return true;
  return false;
};

export const looksLikeGrokRecord = (raw: unknown): boolean => {
  return looksLikeGrokUpdate(raw) || looksLikeGrokSummary(raw) || looksLikeGrokEvent(raw);
};

const parseRecords = (text: string): unknown[] => {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("{")) {
    try {
      const obj = JSON.parse(trimmed) as unknown;
      if (asRecord(obj)) return [obj];
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

const eventOf = (
  opts: {
    id: string;
    ts: string;
    provider: string;
    agent: string;
    sessionId: string;
    kind: LedgerEvent["kind"];
    role?: EventRole;
    summary: string;
    payload?: unknown;
  },
  timeZone: string,
): LedgerEvent => ({
  id: opts.id.slice(0, 80),
  ts: opts.ts,
  day: dayInTz(opts.ts, timeZone),
  provider: opts.provider,
  agent: opts.agent,
  sessionId: opts.sessionId,
  kind: opts.kind,
  role: opts.role,
  summary: previewText(opts.summary),
  payload: opts.payload === undefined ? undefined : capPayload(opts.payload),
});

const flushChunk = (
  pending: { role: EventRole; texts: string[]; ts: string; sessionId: string; idx: number } | null,
  events: LedgerEvent[],
  provider: string,
  agent: string,
  timeZone: string,
): void => {
  if (!pending) return;
  const text = pending.texts.join("").trim();
  if (!text) return;
  events.push(
    eventOf(
      {
        id: stableId([pending.sessionId, pending.ts, pending.role, String(pending.idx)]),
        ts: pending.ts,
        provider,
        agent,
        sessionId: pending.sessionId,
        kind: "message",
        role: pending.role,
        summary: text,
        payload: { text },
      },
      timeZone,
    ),
  );
};

const updatesToEvents = (
  records: unknown[],
  provider: string,
  agentDefault: string,
  sessionDefault: string,
  nowIso: string,
  timeZone: string,
): LedgerEvent[] => {
  const events: LedgerEvent[] = [];
  let pending: { role: EventRole; texts: string[]; ts: string; sessionId: string; idx: number } | null =
    null;
  let idx = 0;
  for (const rawUnknown of records) {
    idx += 1;
    const raw = asRecord(rawUnknown);
    if (!raw) continue;
    const params = asRecord(raw.params);
    const update = params ? asRecord(params.update) : null;
    if (!update) continue;
    const sessionId =
      (typeof params?.sessionId === "string" && params.sessionId) || sessionDefault;
    const ts = tsToIso(raw.timestamp ?? raw.ts, nowIso);
    const kind = typeof update.sessionUpdate === "string" ? update.sessionUpdate : "";
    const meta = asRecord(update._meta);
    const agent = (typeof meta?.modelId === "string" && meta.modelId) || agentDefault;

    if (CHUNK_UPDATES.has(kind)) {
      const role: EventRole = kind === "user_message_chunk" ? "user" : "agent";
      const text = textFromContent(update.content);
      if (!text.trim()) continue;
      if (pending && pending.role === role && pending.sessionId === sessionId) {
        pending.texts.push(text);
        pending.ts = ts;
        continue;
      }
      flushChunk(pending, events, provider, agent, timeZone);
      pending = { role, texts: [text], ts, sessionId, idx };
      continue;
    }

    flushChunk(pending, events, provider, agent, timeZone);
    pending = null;

    if (kind === "tool_call") {
      const name =
        (typeof update.title === "string" && update.title) ||
        (typeof update.kind === "string" && update.kind) ||
        "tool";
      const toolId = typeof update.toolCallId === "string" ? update.toolCallId : String(idx);
      events.push(
        eventOf(
          {
            id: stableId([sessionId, toolId, "tool"]),
            ts,
            provider,
            agent,
            sessionId,
            kind: "tool",
            summary: `Tool: ${name}`,
            payload: { name, id: toolId, input: update.rawInput },
          },
          timeZone,
        ),
      );
      continue;
    }
  }
  flushChunk(pending, events, provider, agentDefault, timeZone);
  return events;
};

const eventsToEvents = (
  records: unknown[],
  provider: string,
  agentDefault: string,
  sessionDefault: string,
  nowIso: string,
  timeZone: string,
): LedgerEvent[] => {
  const events: LedgerEvent[] = [];
  let idx = 0;
  for (const rawUnknown of records) {
    idx += 1;
    const raw = asRecord(rawUnknown);
    if (!raw || typeof raw.type !== "string") continue;
    if (!KEEP_EVENTS.has(raw.type)) continue;
    const sessionId =
      (typeof raw.session_id === "string" && raw.session_id) ||
      (typeof raw.sessionId === "string" && raw.sessionId) ||
      sessionDefault;
    const ts = tsToIso(raw.ts ?? raw.timestamp, nowIso);
    const agent =
      (typeof raw.model_id === "string" && raw.model_id) || agentDefault;
    if (raw.type === "tool_started" || raw.type === "tool_completed") {
      const name = (typeof raw.tool_name === "string" && raw.tool_name) || "tool";
      const toolId = typeof raw.tool_call_id === "string" ? raw.tool_call_id : String(idx);
      events.push(
        eventOf(
          {
            id: stableId([sessionId, toolId, raw.type]),
            ts,
            provider,
            agent,
            sessionId,
            kind: "tool",
            summary: `Tool: ${name}`,
            payload: { name, type: raw.type, outcome: raw.outcome },
          },
          timeZone,
        ),
      );
      continue;
    }
    events.push(
      eventOf(
        {
          id: stableId([sessionId, ts, raw.type, String(idx)]),
          ts,
          provider,
          agent,
          sessionId,
          kind: "message",
          role: "system",
          summary: raw.type.replace(/_/g, " "),
        },
        timeZone,
      ),
    );
  }
  return events;
};

const chatToEvents = (
  records: unknown[],
  provider: string,
  agentDefault: string,
  sessionDefault: string,
  startIso: string,
  endIso: string | undefined,
  timeZone: string,
): LedgerEvent[] => {
  const events: LedgerEvent[] = [];
  let idx = 0;
  let lastTs = startIso;
  for (const rawUnknown of records) {
    idx += 1;
    const raw = asRecord(rawUnknown);
    if (!raw) continue;
    const type = typeof raw.type === "string" ? raw.type : typeof raw.role === "string" ? raw.role : "";
    if (type === "system" || type === "reasoning") continue;
    const sessionId =
      (typeof raw.sessionId === "string" && raw.sessionId) ||
      (typeof raw.session_id === "string" && raw.session_id) ||
      sessionDefault;
    const ts = tsToIso(raw.ts ?? raw.timestamp ?? raw.created_at, startIso);
    lastTs = ts;
    if (type === "tool_result" || type === "tool_use" || type === "tool_call" || type === "tool") {
      const name = (typeof raw.name === "string" && raw.name) || "tool";
      events.push(
        eventOf(
          {
            id: stableId([sessionId, ts, "tool", name, String(idx)]),
            ts,
            provider,
            agent: agentDefault,
            sessionId,
            kind: "tool",
            summary: `Tool: ${name}`,
            payload: { name, input: raw.input, output: raw.output ?? raw.content },
          },
          timeZone,
        ),
      );
      continue;
    }
    if (type !== "user" && type !== "assistant" && type !== "agent") continue;
    const text = (textFromContent(raw.content) || (typeof raw.text === "string" ? raw.text : "")).trim();
    if (!text) continue;
    const role: EventRole = type === "user" ? "user" : "agent";
    events.push(
      eventOf(
        {
          id: stableId([sessionId, ts, role, String(idx)]),
          ts,
          provider,
          agent: agentDefault,
          sessionId,
          kind: "message",
          role,
          summary: text,
          payload: { text },
        },
        timeZone,
      ),
    );
  }
  if (events.length && endIso && Date.parse(endIso) > Date.parse(lastTs)) {
    events.push(
      eventOf(
        {
          id: stableId([sessionDefault, endIso, "span"]),
          ts: endIso,
          provider,
          agent: agentDefault,
          sessionId: sessionDefault,
          kind: "message",
          role: "system",
          summary: "session ended",
        },
        timeZone,
      ),
    );
  }
  return events;
};

const summaryToEvents = (
  raw: Record<string, unknown>,
  provider: string,
  agentDefault: string,
  sessionDefault: string,
  timeZone: string,
): LedgerEvent[] => {
  const start = tsToIso(raw.created_at, "");
  const end = tsToIso(raw.last_active_at ?? raw.updated_at, start);
  if (!start) return [];
  const title =
    (typeof raw.generated_title === "string" && raw.generated_title.trim()) ||
    (typeof raw.session_summary === "string" && raw.session_summary.trim()) ||
    "";
  const agent =
    (typeof raw.agent_name === "string" && raw.agent_name) ||
    (typeof raw.current_model_id === "string" && raw.current_model_id) ||
    agentDefault;
  const events: LedgerEvent[] = [];
  if (title) {
    events.push(
      eventOf(
        {
          id: stableId([sessionDefault, start, "title"]),
          ts: start,
          provider,
          agent,
          sessionId: sessionDefault,
          kind: "message",
          role: "user",
          summary: title,
          payload: { text: title },
        },
        timeZone,
      ),
    );
  } else {
    events.push(
      eventOf(
        {
          id: stableId([sessionDefault, start, "start"]),
          ts: start,
          provider,
          agent,
          sessionId: sessionDefault,
          kind: "message",
          role: "system",
          summary: "session started",
        },
        timeZone,
      ),
    );
  }
  if (end && end !== start) {
    events.push(
      eventOf(
        {
          id: stableId([sessionDefault, end, "span"]),
          ts: end,
          provider,
          agent,
          sessionId: sessionDefault,
          kind: "message",
          role: "system",
          summary: "session ended",
        },
        timeZone,
      ),
    );
  }
  return events;
};

export const grokTranscriptToEvents = (
  text: string,
  defaults?: GrokAdapterDefaults,
): LedgerEvent[] => {
  const provider = defaults?.provider ?? "grok";
  const agentDefault = defaults?.agent ?? "grok";
  const sessionDefault = sessionIdFromDefaults(defaults);
  const timeZone = defaults?.timeZone ?? DEFAULT_TIMEZONE;
  const nowIso = defaults?.fallbackStartIso ?? new Date().toISOString();
  const records = parseRecords(text);
  if (!records.length) return [];

  const first = records[0];
  if (records.length === 1 && looksLikeGrokSummary(first)) {
    const raw = asRecord(first);
    return raw ? summaryToEvents(raw, provider, agentDefault, sessionDefault, timeZone) : [];
  }
  if (looksLikeGrokUpdate(first)) {
    return updatesToEvents(records, provider, agentDefault, sessionDefault, nowIso, timeZone);
  }
  if (looksLikeGrokEvent(first) && asRecord(first)?.type !== "user" && asRecord(first)?.type !== "assistant") {
    return eventsToEvents(records, provider, agentDefault, sessionDefault, nowIso, timeZone);
  }
  return chatToEvents(
    records,
    provider,
    agentDefault,
    sessionDefault,
    defaults?.fallbackStartIso ?? nowIso,
    defaults?.fallbackEndIso,
    timeZone,
  );
};
