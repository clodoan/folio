import { useState } from "react";
import type { LedgerEvent } from "../schema";
import { formatTimePT } from "../schema";

type Props = { event: LedgerEvent };

const PAYLOAD_UI_CAP = 4000;

function payloadView(payload: unknown): { text: string; truncated: boolean } {
  try {
    const text = JSON.stringify(payload, null, 2) ?? "";
    if (text.length <= PAYLOAD_UI_CAP) return { text, truncated: false };
    return {
      text: `${text.slice(0, PAYLOAD_UI_CAP)}\n… collapsed ${text.length - PAYLOAD_UI_CAP} more chars`,
      truncated: true,
    };
  } catch {
    return { text: String(payload), truncated: false };
  }
}

export function EventRow({ event }: Props) {
  const [open, setOpen] = useState(false);
  const hasDetail =
    event.payload !== undefined ||
    (event.artifacts && event.artifacts.length > 0);

  const payload = event.payload !== undefined ? payloadView(event.payload) : null;

  return (
    <article
      className={`event-row kind-${event.kind}${event.needsDecision ? " needs-decision" : ""}${event.decision ? ` decision-${event.decision}` : ""}${open ? " open" : ""}`}
    >
      <button
        type="button"
        className="event-main"
        onClick={() => hasDetail && setOpen((o) => !o)}
        disabled={!hasDetail}
        aria-expanded={open}
      >
        <time className="event-time" dateTime={event.ts}>
          {formatTimePT(event.ts)}
        </time>
        <span className={`kind-badge kind-${event.kind}`}>{event.kind}</span>
        {event.role ? <span className="role-badge">{event.role}</span> : null}
        {event.needsDecision || event.decision ? (
          <span className={`decision-badge ${event.decision ?? "pending"}`}>
            {event.decision ?? "pending"}
          </span>
        ) : null}
        <span className="event-summary">{event.summary}</span>
        {hasDetail ? (
          <span className="expand-hint" aria-hidden>
            {open ? "▾" : "▸"}
          </span>
        ) : null}
      </button>
      {open && hasDetail ? (
        <div className="event-detail">
          {payload ? (
            <pre className="payload">
              {payload.truncated ? <span className="payload-cap">payload capped{"\n"}</span> : null}
              {payload.text}
            </pre>
          ) : null}
          {event.artifacts?.length ? (
            <ul className="artifacts">
              {event.artifacts.map((a, i) => (
                <li key={`${a.label}-${i}`}>
                  <span className="art-type">{a.type}</span>
                  <span className="art-label">{a.label}</span>
                  {a.url ? (
                    <a href={a.url} target="_blank" rel="noreferrer">
                      {a.url}
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="event-meta mono">
            id={event.id}
            {event.parentId ? ` · parent=${event.parentId}` : ""}
          </div>
        </div>
      ) : null}
    </article>
  );
}
