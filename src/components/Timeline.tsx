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
          Drop JSONL into <code>inbox/</code>, or wait. Folio harvests local agent sessions on this
          machine. Day files live in <code>data/days</code>.
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
