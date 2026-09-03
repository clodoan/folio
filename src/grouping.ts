import type { LedgerEvent } from "./schema";

export function groupBySession(
  events: LedgerEvent[],
): Map<string, LedgerEvent[]> {
  const map = new Map<string, LedgerEvent[]>();
  const sorted = [...events].sort(
    (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime(),
  );
  for (const e of sorted) {
    const list = map.get(e.sessionId) ?? [];
    list.push(e);
    map.set(e.sessionId, list);
  }
  return map;
}

export function uniqueProviders(events: LedgerEvent[]): string[] {
  return [...new Set(events.map((e) => e.provider))].sort();
}

export function hasCloudOrGrokEvents(events: LedgerEvent[]): boolean {
  return events.some((e) => {
    const p = e.provider.toLowerCase();
    const a = e.agent.toLowerCase();
    return (
      p.includes("grok") ||
      p.includes("xai") ||
      p === "cloud" ||
      p.includes("cloud") ||
      a.includes("grok")
    );
  });
}
