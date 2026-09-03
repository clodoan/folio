import type { DayActivity } from "../activity";
import { formatDuration } from "../activity";
import { SessionList } from "./SessionList";

type Props = {
  activity: DayActivity;
  day: string;
  writing: boolean;
  wrotePath: string | null;
  onWriteEod: () => void;
};

function Ring({
  display,
  pct,
  label,
  color,
}: {
  display: string;
  pct: number;
  label: string;
  color: string;
}) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, pct));
  const dash = `${c * clamped} ${c}`;
  return (
    <div className="ring" title={`${label}: ${display}`}>
      <svg viewBox="0 0 84 84" width="84" height="84" aria-hidden="true">
        <circle cx="42" cy="42" r={r} className="ring-track" />
        <circle
          cx="42"
          cy="42"
          r={r}
          className="ring-value"
          stroke={color}
          strokeDasharray={dash}
          transform="rotate(-90 42 42)"
        />
      </svg>
      <div className="ring-label">
        <strong>{label}</strong>
        <span>{display}</span>
      </div>
    </div>
  );
}

export function TodayCard({ activity, day, writing, wrotePath, onWriteEod }: Props) {
  const maxHour = Math.max(1, ...activity.hourBlocks.map((h) => h.minutes));
  const maxProv = Math.max(1, ...activity.byProvider.map((p) => p.minutes));
  return (
    <section className="today-card" aria-label="Today activity">
      <div className="today-card-head">
        <h2>Today</h2>
        <p className="today-narrative">{activity.narrative}</p>
      </div>
      <div className="rings">
        <Ring
          display={formatDuration(activity.activeMinutes)}
          pct={activity.activeMinutes / 480}
          label="Active"
          color="var(--ok)"
        />
        <Ring
          display={String(activity.sessionCount)}
          pct={activity.sessionCount / 8}
          label="Sessions"
          color="var(--accent)"
        />
        <Ring
          display={String(activity.toolCount)}
          pct={activity.toolCount / 40}
          label="Tools"
          color="var(--proof)"
        />
      </div>
      {activity.topics.length ? (
        <div className="chips topic-chips">
          {activity.topics.slice(0, 10).map((t) => (
            <span key={t.topic} className="chip active" title={`${t.sessions} sessions`}>
              {t.topic} · {formatDuration(t.minutes)}
            </span>
          ))}
        </div>
      ) : (
        <p className="muted">Topics appear after the first user message in a session.</p>
      )}
      {activity.byProvider.length ? (
        <div className="provider-bars">
          {activity.byProvider.map((p) => (
            <div key={p.provider} className="provider-bar-row">
              <span className="chip provider">{p.provider}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${(p.minutes / maxProv) * 100}%` }} />
              </div>
              <span className="muted">
                {formatDuration(p.minutes)} · {p.sessions} sess
              </span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="hour-strip" aria-label="Hourly activity">
        {activity.hourBlocks.map((h) => (
          <div
            key={h.hour}
            className="hour-cell"
            title={`${String(h.hour).padStart(2, "0")}:00 · ${formatDuration(h.minutes)}`}
          >
            <div
              className="hour-fill"
              style={{ height: `${Math.max(h.minutes ? 8 : 0, (h.minutes / maxHour) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="hour-legend muted">
        <span>12a</span>
        <span>6a</span>
        <span>12p</span>
        <span>6p</span>
        <span>11p</span>
      </div>
      <div className="eod-row">
        <button type="button" className="btn primary" onClick={onWriteEod} disabled={writing}>
          {writing ? "Writing…" : "Write EOD summary"}
        </button>
        {wrotePath ? <span className="muted">Wrote {wrotePath}</span> : null}
      </div>
      <h3 className="session-heading">Sessions</h3>
      <SessionList slices={activity.slices} />
      <p className="muted eod-hint">
        End of day file: <code>data/summaries/{day}.md</code>
      </p>
    </section>
  );
}
