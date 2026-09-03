import type { LedgerEvent } from "./schema";
import { formatClockPT } from "./schema";
import { computeDayActivity, formatDuration } from "./activity";

/**
 * Deterministic EOD markdown from topics / times / providers. No LLM, no event dump.
 */
export function summarizeDay(day: string, events: LedgerEvent[]): string {
  const activity = computeDayActivity(events);
  const topicList = activity.topics
    .slice(0, 8)
    .map((t) => t.topic)
    .join(", ");
  const headline =
    activity.sessionCount === 0
      ? "No agent sessions recorded for this day."
      : `You spent ${formatDuration(activity.activeMinutes)} across ${activity.sessionCount} session${activity.sessionCount === 1 ? "" : "s"}.${topicList ? ` Topics: ${topicList}.` : ""}`;

  const lines: string[] = [
    `# Ledger — ${day}`,
    "",
    headline,
    "",
    `- Active time: ${formatDuration(activity.activeMinutes)}`,
    `- Sessions: ${activity.sessionCount}`,
    `- Tools: ${activity.toolCount}`,
    "",
    "## Topics",
    "",
  ];

  if (activity.topics.length === 0) {
    lines.push("_None._", "");
  } else {
    for (const t of activity.topics) {
      lines.push(`- ${t.topic} — ${formatDuration(t.minutes)} (${t.sessions} session${t.sessions === 1 ? "" : "s"})`);
    }
    lines.push("");
  }

  lines.push("## Time by provider", "");
  if (activity.byProvider.length === 0) {
    lines.push("_None._", "");
  } else {
    for (const p of activity.byProvider) {
      lines.push(`- ${p.provider} — ${formatDuration(p.minutes)} · ${p.sessions} session${p.sessions === 1 ? "" : "s"} · ${p.tools} tools`);
    }
    lines.push("");
  }

  lines.push("## Sessions", "");
  if (activity.slices.length === 0) {
    lines.push("_No sessions._", "");
  } else {
    for (const s of activity.slices) {
      const start = formatClockPT(new Date(s.startMs).toISOString());
      const end = formatClockPT(new Date(s.endMs).toISOString());
      lines.push(
        `- ${s.topic} · ${s.provider} · ${start} – ${end} · ${formatDuration(s.minutes)}`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}
