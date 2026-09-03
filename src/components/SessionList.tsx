import { formatClockPT } from "../schema";
import type { ActivitySlice } from "../activity";
import { formatDuration } from "../activity";

type Props = { slices: ActivitySlice[] };

export function SessionList({ slices }: Props) {
  if (slices.length === 0) {
    return (
      <p className="muted session-empty">
        No local sessions yet. Ledger collects Cursor transcripts in the background.
      </p>
    );
  }
  return (
    <ul className="session-list">
      {slices.map((s) => {
        const start = formatClockPT(new Date(s.startMs).toISOString());
        const end = formatClockPT(new Date(s.endMs).toISOString());
        return (
          <li key={`${s.sessionId}-${s.startMs}`} className="session-row">
            <div className="session-topic">{s.topic}</div>
            <div className="session-meta">
              <span className="chip provider">{s.provider}</span>
              <span className="muted">
                {start} – {end}
              </span>
              <span className="session-dur">{formatDuration(s.minutes)}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
