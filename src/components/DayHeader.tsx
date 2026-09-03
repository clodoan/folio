type Props = {
  day: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onSummarize: () => void;
  onToggleSummary: () => void;
  summarizing: boolean;
  hasSummary: boolean;
  summaryOpen: boolean;
  isToday: boolean;
  daemonUp: boolean;
};

export function DayHeader({
  day,
  onPrev,
  onNext,
  onToday,
  onSummarize,
  onToggleSummary,
  summarizing,
  hasSummary,
  summaryOpen,
  isToday,
  daemonUp,
}: Props) {
  return (
    <header className="day-header">
      <div className="brand">
        <h1>Ledger</h1>
        <span className="tag">end of day</span>
      </div>
      <div className="day-nav">
        <button type="button" className="btn ghost" onClick={onPrev} aria-label="Previous day">
          &larr;
        </button>
        <time className="day-label" dateTime={day}>
          {day}
          {isToday ? <span className="today-badge">Today</span> : null}
        </time>
        <button type="button" className="btn ghost" onClick={onNext} aria-label="Next day">
          &rarr;
        </button>
        {!isToday ? (
          <button type="button" className="btn ghost" onClick={onToday}>
            Today
          </button>
        ) : null}
        {daemonUp ? <span className="today-badge">watching</span> : <span className="muted">no ingest</span>}
      </div>
      <div className="export-actions">
        <button type="button" className="btn primary" onClick={onSummarize} disabled={summarizing}>
          {summarizing ? "Writing…" : "Write EOD"}
        </button>
        {hasSummary ? (
          <button type="button" className="btn" onClick={onToggleSummary}>
            {summaryOpen ? "Hide note" : "Show note"}
          </button>
        ) : null}
      </div>
    </header>
  );
}
