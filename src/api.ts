export function apiOrigin(): string {
  if (typeof window === "undefined") return "";
  try {
    const q = new URLSearchParams(window.location.search).get("api");
    if (q) return q.replace(/\/$/, "");
  } catch {
    /* ignore */
  }
  const w = window as unknown as { ledger?: { apiBase?: string } };
  if (w.ledger?.apiBase) return w.ledger.apiBase.replace(/\/$/, "");
  if (window.location.protocol === "file:") return "http://127.0.0.1:4173";
  return "";
}

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${apiOrigin()}${p}`;
}

export type DayStat = { mtimeMs: number; size: number };

export type Health = {
  ok: boolean;
  service?: string;
  ingestSeq?: number;
  days?: Record<string, DayStat>;
  watches?: string[];
};
