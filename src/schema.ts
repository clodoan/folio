import { z } from "zod";

export const DEFAULT_TIMEZONE = "America/Los_Angeles";

export const EventKindSchema = z.enum(["message", "tool"]);
export type EventKind = z.infer<typeof EventKindSchema>;

export const EventRoleSchema = z.enum(["user", "agent", "system"]);
export type EventRole = z.infer<typeof EventRoleSchema>;

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
});
export type LedgerEvent = z.infer<typeof LedgerEventSchema>;

export const payloadText = (payload: unknown): string => {
  if (typeof payload !== "object" || payload === null || !("text" in payload)) return "";
  const t = (payload as { text?: unknown }).text;
  return typeof t === "string" ? t : "";
};

export const parseDayJsonl = (text: string): LedgerEvent[] => {
  const events: LedgerEvent[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = LedgerEventSchema.safeParse(JSON.parse(trimmed));
      if (parsed.success) events.push(parsed.data);
    } catch {
    }
  }
  return events;
};

export const dayInTz = (
  isoOrDate: string | Date = new Date(),
  timeZone: string = DEFAULT_TIMEZONE,
): string => {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
};
