import {
  type LedgerEvent,
  parseDayJsonl,
  eventsToJsonl,
  dayInPT,
} from "./schema";
import { apiUrl, type Health } from "./api";
import { groupBySession, uniqueProviders, hasCloudOrGrokEvents } from "./grouping";

export { groupBySession, uniqueProviders, hasCloudOrGrokEvents };

export function todayPT(): string {
  return dayInPT(new Date());
}

/**
 * Browser day store: fetch JSONL from canonical /data/days/YYYY-MM-DD.jsonl
 * (daemon and Vite middleware serve data/days).
 */
export async function loadDay(day: string): Promise<LedgerEvent[]> {
  const res = await fetch(apiUrl(`/data/days/${day}.jsonl`));
  if (res.status === 404) return [];
  if (!res.ok) {
    throw new Error(`Failed to load day ${day}: ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  return parseDayJsonl(text);
}

export function serializeDay(events: LedgerEvent[]): string {
  return eventsToJsonl(events);
}

export async function loadSummaryFile(day: string): Promise<string | null> {
  const res = await fetch(apiUrl(`/data/summaries/${day}.md`));
  if (res.status === 404) return null;
  if (!res.ok) return null;
  return res.text();
}

export async function fetchHealth(): Promise<Health | null> {
  try {
    const res = await fetch(apiUrl("/api/health"));
    if (!res.ok) return null;
    return (await res.json()) as Health;
  } catch {
    return null;
  }
}

export async function probeDaemon(): Promise<boolean> {
  const h = await fetchHealth();
  return Boolean(h?.ok);
}

export async function fetchApiSummary(day: string): Promise<string | null> {
  try {
    const res = await fetch(apiUrl(`/api/summary/${day}`));
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

export async function postSummarize(day: string): Promise<string> {
  const res = await fetch(apiUrl("/api/summarize"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ day }),
  });
  if (!res.ok) throw new Error(`summarize failed: ${res.status}`);
  return res.text();
}

export function openEventStream(onPing: () => void): () => void {
  const url = apiUrl("/api/stream");
  if (typeof EventSource === "undefined") return () => {};
  try {
    const es = new EventSource(url);
    es.onmessage = () => onPing();
    es.addEventListener("ingest", () => onPing());
    return () => es.close();
  } catch {
    return () => {};
  }
}
