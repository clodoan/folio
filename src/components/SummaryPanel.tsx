type Props = {
  day: string;
  markdown: string | null;
  open: boolean;
  source: "daemon" | "client" | "file" | null;
  onClose: () => void;
  onDownload: () => void;
};

export function SummaryPanel({ day, markdown, open, source, onClose, onDownload }: Props) {
  if (!open) return null;
  return (
    <aside className="summary-panel" aria-label="Day summary">
      <div className="summary-panel-head">
        <h2>Summary — {day}</h2>
        <div className="summary-panel-actions">
          {source ? <span className="muted">{source}</span> : null}
          <button type="button" className="btn" onClick={onDownload} disabled={!markdown}>
            Download
          </button>
          <button type="button" className="btn ghost" onClick={onClose} aria-label="Close summary">
            Close
          </button>
        </div>
      </div>
      {markdown ? (
        <pre className="summary-md">{markdown}</pre>
      ) : (
        <p className="muted">No summary yet. Use Summarize today.</p>
      )}
    </aside>
  );
}
