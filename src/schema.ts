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
  ts: z.string(),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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
    }
  }
  return events;
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
