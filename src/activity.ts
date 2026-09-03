import type { LedgerEvent } from "./schema";
import { groupBySession } from "./grouping";

const ACTIVITY_GAP_MS = 15 * 60 * 1000;
const MIN_SESSION_MS = 60 * 1000;

export type ActivitySlice = {
  sessionId: string;
  provider: string;
  agent: string;
  startMs: number;
  endMs: number;
  minutes: number;
  tools: number;
  topic: string;
};

const tsMs = (iso: string): number => {
  const n = Date.parse(iso);
  return Number.isNaN(n) ? 0 : n;
};

const stripUserChrome = (text: string): string =>
  text
    .replace(/<timestamp>[\s\S]*?<\/timestamp>/gi, " ")
    .replace(/<\/?user_query>/gi, " ")
    .replace(/<user_info>[\s\S]*?<\/user_info>/gi, " ")
    .replace(/<[\s\S]*?>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const quotedPhrase = (text: string): string | undefined => {
  const m = text.match(/[“"]([^”"]{3,80})[”"]/) || text.match(/'([^']{3,80})'/);
  if (!m) return undefined;
  return m[1].trim();
};

const topicFromText = (text: string, fallback: string): string => {
  const clean = stripUserChrome(text);
  if (!clean) return fallback;
  const quoted = quotedPhrase(clean);
  if (quoted) return quoted.slice(0, 72);
  const words = clean.split(/\s+/).slice(0, 8);
  let t = words.join(" ");
  t = t.replace(/[.,;:!?]+$/g, "");
  return t.slice(0, 72) || fallback;
};

const topicForEvents = (events: LedgerEvent[], sessionId: string): string => {
  const user = events.find((e) => e.kind === "message" && e.role === "user");
  const payloadText =
    user && typeof user.payload === "object" && user.payload && "text" in user.payload
      ? String((user.payload as { text?: unknown }).text ?? "")
      : "";
  const raw = payloadText || user?.summary || "";
  const fb = sessionId.length > 12 ? `session ${sessionId.slice(0, 8)}` : sessionId;
  return topicFromText(raw, fb);
};

const minutesOf = (startMs: number, endMs: number): number => {
  const span = Math.max(0, endMs - startMs);
  const used = span === 0 ? MIN_SESSION_MS : span;
  return Math.max(1, Math.round(used / 60000));
};

export const splitActivitySlices = (events: LedgerEvent[]): ActivitySlice[] => {
  const groups = groupBySession(events);
  const slices: ActivitySlice[] = [];
  for (const [sessionId, sess] of groups) {
    if (!sess.length) continue;
    const sorted = [...sess].sort((a, b) => tsMs(a.ts) - tsMs(b.ts) || a.id.localeCompare(b.id));
    let bucket: LedgerEvent[] = [sorted[0]];
    const flush = (list: LedgerEvent[]) => {
      if (!list.length) return;
      const startMs = tsMs(list[0].ts);
      const endMs = Math.max(tsMs(list[list.length - 1].ts), startMs);
      slices.push({
        sessionId,
        provider: list[0].provider,
        agent: list[0].agent,
        startMs,
        endMs,
        minutes: minutesOf(startMs, endMs),
        tools: list.filter((e) => e.kind === "tool").length,
        topic: topicForEvents(list, sessionId),
      });
    };
    for (let i = 1; i < sorted.length; i++) {
      const prev = tsMs(sorted[i - 1].ts);
      const cur = tsMs(sorted[i].ts);
      if (cur - prev > ACTIVITY_GAP_MS) {
        flush(bucket);
        bucket = [sorted[i]];
      } else {
        bucket.push(sorted[i]);
      }
    }
    flush(bucket);
  }
  slices.sort((a, b) => a.startMs - b.startMs || a.sessionId.localeCompare(b.sessionId));
  return slices;
};
