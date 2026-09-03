import type { LedgerEvent } from "./schema";

export const groupBySession = (events: LedgerEvent[]): Map<string, LedgerEvent[]> => {
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
};
