import type { LedgerEvent } from "./schema";
import { groupBySession } from "./grouping";

export const ACTIVITY_GAP_MS = 15 * 60 * 1000;
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

export type TopicRow = {
  topic: string;
  minutes: number;
  sessions: number;
  providers: string[];
};

export type ProviderRow = {
  provider: string;
  minutes: number;
  sessions: number;
  tools: number;
};

export type HourBlock = {
  hour: number;
  minutes: number;
};

export type DayActivity = {
  activeMinutes: number;
  sessionCount: number;
  toolCount: number;
  slices: ActivitySlice[];
  topics: TopicRow[];
  byProvider: ProviderRow[];
  hourBlocks: HourBlock[];
  narrative: string;
};

function tsMs(iso: string): number {
  const n = Date.parse(iso);
  return Number.isNaN(n) ? 0 : n;
}

function stripUserChrome(text: string): string {
  return text
    .replace(/<timestamp>[\s\S]*?<\/timestamp>/gi, " ")
    .replace(/<\/?user_query>/gi, " ")
    .replace(/<user_info>[\s\S]*?<\/user_info>/gi, " ")
    .replace(/<[\s\S]*?>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function quotedPhrase(text: string): string | undefined {
  const m = text.match(/[“"]([^”"]{3,80})[”"]/) || text.match(/'([^']{3,80})'/);
  if (!m) return undefined;
  return m[1].trim();
}

export function topicFromText(text: string, fallback: string): string {
  const clean = stripUserChrome(text);
  if (!clean) return fallback;
  const quoted = quotedPhrase(clean);
  if (quoted) return quoted.slice(0, 72);
  const words = clean.split(/\s+/).slice(0, 8);
  let t = words.join(" ");
  t = t.replace(/[.,;:!?]+$/g, "");
  return t.slice(0, 72) || fallback;
}

export function topicForEvents(events: LedgerEvent[], sessionId: string): string {
  const user = events.find((e) => e.kind === "message" && e.role === "user");
  const payloadText =
    user && typeof user.payload === "object" && user.payload && "text" in user.payload
      ? String((user.payload as { text?: unknown }).text ?? "")
      : "";
  const raw = payloadText || user?.summary || "";
  const fb = sessionId.length > 12 ? `session ${sessionId.slice(0, 8)}` : sessionId;
  return topicFromText(raw, fb);
}

function minutesOf(startMs: number, endMs: number): number {
  const span = Math.max(0, endMs - startMs);
  const used = span === 0 ? MIN_SESSION_MS : span;
  return Math.max(1, Math.round(used / 60000));
}

export function splitActivitySlices(events: LedgerEvent[]): ActivitySlice[] {
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
}

export function formatDuration(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (rem === 0) return `${h}h`;
  return `${h}h ${rem}m`;
}

export function buildNarrative(activeMinutes: number, sessionCount: number, topics: TopicRow[]): string {
  if (sessionCount === 0) {
    return "No agent sessions recorded for this day.";
  }
  const main = topics.slice(0, 4).map((t) => `${t.topic} (${formatDuration(t.minutes)})`);
  const topicPart = main.length ? ` Main topics: ${main.join(", ")}.` : "";
  return `You spent ~${formatDuration(activeMinutes)} across ${sessionCount} session${sessionCount === 1 ? "" : "s"}.${topicPart}`;
}

function hourBlocksPT(slices: ActivitySlice[]): HourBlock[] {
  const minutes = Array.from({ length: 24 }, () => 0);
  const hourFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    hourCycle: "h23",
  });
  for (const s of slices) {
    const end = Math.max(s.endMs, s.startMs + MIN_SESSION_MS);
    let cursor = s.startMs;
    while (cursor < end) {
      const hour = Number(hourFmt.format(new Date(cursor)));
      const chunkEnd = Math.min(end, cursor + 15 * 60 * 1000);
      const mins = (chunkEnd - cursor) / 60000;
      if (hour >= 0 && hour < 24) minutes[hour] += mins;
      cursor = chunkEnd;
    }
  }
  return minutes.map((m, hour) => ({ hour, minutes: Math.round(m * 10) / 10 }));
}

export function computeDayActivity(events: LedgerEvent[]): DayActivity {
  const slices = splitActivitySlices(events);
  const activeMinutes = slices.reduce((a, s) => a + s.minutes, 0);
  const sessionCount = slices.length;
  const toolCount = events.filter((e) => e.kind === "tool").length;

  const topicMap = new Map<string, TopicRow>();
  for (const s of slices) {
    const key = s.topic || "untitled";
    const row = topicMap.get(key) ?? { topic: key, minutes: 0, sessions: 0, providers: [] };
    row.minutes += s.minutes;
    row.sessions += 1;
    if (!row.providers.includes(s.provider)) row.providers.push(s.provider);
    topicMap.set(key, row);
  }
  const topics = [...topicMap.values()].sort((a, b) => b.minutes - a.minutes || a.topic.localeCompare(b.topic));

  const provMap = new Map<string, ProviderRow>();
  for (const s of slices) {
    const row = provMap.get(s.provider) ?? { provider: s.provider, minutes: 0, sessions: 0, tools: 0 };
    row.minutes += s.minutes;
    row.sessions += 1;
    row.tools += s.tools;
    provMap.set(s.provider, row);
  }
  const byProvider = [...provMap.values()].sort((a, b) => b.minutes - a.minutes || a.provider.localeCompare(b.provider));

  return {
    activeMinutes,
    sessionCount,
    toolCount,
    slices,
    topics,
    byProvider,
    hourBlocks: hourBlocksPT(slices),
    narrative: buildNarrative(activeMinutes, sessionCount, topics),
  };
}
