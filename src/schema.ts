import { z } from "zod";

export const EventKindSchema = z.enum([
  "message",
  "tool",
  "decision",
  "proof",
  "error",
]);
export type EventKind = z.infer<typeof EventKindSchema>;

export const EventRoleSchema = z.enum(["user", "agent", "system"]);
export type EventRole = z.infer<typeof EventRoleSchema>;

export const DecisionStatusSchema = z.enum([
  "approved",
  "rejected",
  "pending",
]);
export type DecisionStatus = z.infer<typeof DecisionStatusSchema>;

export const ArtifactSchema = z.object({
  type: z.string(),
  label: z.string(),
  url: z.string().optional(),
});
export type Artifact = z.infer<typeof ArtifactSchema>;

export const LedgerEventSchema = z.object({
  id: z.string(),
  ts: z.string(), // ISO
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  provider: z.string(),
  agent: z.string(),
  sessionId: z.string(),
  kind: EventKindSchema,
  role: EventRoleSchema.optional(),
  summary: z.string(),
  payload: z.unknown().optional(),
  artifacts: z.array(ArtifactSchema).optional(),
  parentId: z.string().optional(),
  needsDecision: z.boolean().optional(),
  decision: DecisionStatusSchema.optional(),
});
export type LedgerEvent = z.infer<typeof LedgerEventSchema>;

export const KINDS: EventKind[] = [
  "message",
  "tool",
  "decision",
  "proof",
  "error",
];

export function parseEvent(raw: unknown): LedgerEvent {
  return LedgerEventSchema.parse(raw);
}

export function parseDayJsonl(text: string): LedgerEvent[] {
  const events: LedgerEvent[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(parseEvent(JSON.parse(trimmed)));
    } catch {
      /* skip junk store lines */
    }
  }
  return events;
}

export function eventsToJsonl(events: LedgerEvent[]): string {
  return events.map((e) => JSON.stringify(e)).join("\n") + (events.length ? "\n" : "");
}

/** Calendar day label in America/Los_Angeles as YYYY-MM-DD. */
export function dayInPT(isoOrDate: string | Date = new Date()): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  // Noon UTC avoids DST edge weirdness for calendar math
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

export function formatTimePT(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function shortId(id: string, n = 8): string {
  return id.length <= n ? id : id.slice(0, n);
}

/** Clock time in America/Los_Angeles, no seconds. */
export function formatClockPT(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}
