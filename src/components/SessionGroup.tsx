import type { LedgerEvent } from "../schema";
import { formatTimePT, shortId } from "../schema";
import { EventRow } from "./EventRow";

type Props = { events: LedgerEvent[] };

export function SessionGroup({ events }: Props) {
  if (events.length === 0) return null;
  const head = events[0];
  const start = events[0].ts;
  const end = events[events.length - 1].ts;

  return (
    <section className="session-group">
      <header className="session-header">
        <span className="chip provider">{head.provider}</span>
        <span className="chip agent">{head.agent}</span>
        <span className="mono session-id" title={head.sessionId}>
          {shortId(head.sessionId)}
        </span>
        <span className="session-range muted">
          {formatTimePT(start)}
          {start !== end ? ` – ${formatTimePT(end)}` : ""}
          <span className="count"> · {events.length}</span>
        </span>
      </header>
      <div className="session-events">
        {events.map((e) => (
          <EventRow key={e.id} event={e} />
        ))}
      </div>
    </section>
  );
}
