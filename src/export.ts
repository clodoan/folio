import type { LedgerEvent } from "./schema";
import { formatTimePT } from "./schema";
import { computeDayActivity } from "./activity";

export function exportDayJson(day: string, events: LedgerEvent[]): string {
  return JSON.stringify({ day, count: events.length, events }, null, 2);
}

export function exportDayMarkdown(day: string, events: LedgerEvent[]): string {
  const lines: string[] = [
    `# Ledger — ${day}`,
    "",
    computeDayActivity(events).narrative,
    "",
    `Events: ${events.length}`,
    "",
  ];

  const bySession = new Map<string, LedgerEvent[]>();
  const sorted = [...events].sort(
    (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime(),
  );
  for (const e of sorted) {
    const list = bySession.get(e.sessionId) ?? [];
    list.push(e);
    bySession.set(e.sessionId, list);
  }

  for (const [sessionId, sess] of bySession) {
    const head = sess[0];
    lines.push(
      `## ${head.provider} / ${head.agent} — \`${sessionId.slice(0, 8)}\``,
    );
    lines.push("");
    for (const e of sess) {
      const flags: string[] = [];
      if (e.needsDecision) flags.push("needs-decision");
      if (e.decision) flags.push(`decision:${e.decision}`);
      const flagStr = flags.length ? ` [${flags.join(", ")}]` : "";
      lines.push(
        `- **${formatTimePT(e.ts)}** \`${e.kind}\`${e.role ? ` (${e.role})` : ""}${flagStr} — ${e.summary}`,
      );
      if (e.artifacts?.length) {
        for (const a of e.artifacts) {
          lines.push(`  - artifact: ${a.label} (${a.type})${a.url ? ` — ${a.url}` : ""}`);
        }
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
