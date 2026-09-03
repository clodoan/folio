import type { LedgerEvent } from "../schema";
import { groupBySession } from "../store";
import { SessionGroup } from "./SessionGroup";

type Props = { events: LedgerEvent[] };

export function Timeline({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="empty-day">
        <p>No events for this day.</p>
        <p className="muted">
          Drop JSONL into <code>inbox/</code> or wait for Cursor transcripts under <code>~/.cursor/projects/*/agent-transcripts</code>. Canonical store: <code>data/days</code>.
        </p>
      </div>
    );
  }

  const groups = groupBySession(events);

  return (
    <div className="timeline">
      {[...groups.entries()].map(([sessionId, sess]) => (
        <SessionGroup key={sessionId} events={sess} />
      ))}
    </div>
  );
}
