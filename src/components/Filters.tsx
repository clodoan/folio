import type { EventKind } from "../schema";
import { KINDS } from "../schema";

type Props = {
  providers: string[];
  selectedProviders: Set<string>;
  selectedKinds: Set<EventKind>;
  needsDecisionOnly: boolean;
  search: string;
  onToggleProvider: (p: string) => void;
  onToggleKind: (k: EventKind) => void;
  onToggleNeedsDecision: () => void;
  onSearch: (q: string) => void;
};

export function Filters({
  providers,
  selectedProviders,
  selectedKinds,
  needsDecisionOnly,
  search,
  onToggleProvider,
  onToggleKind,
  onToggleNeedsDecision,
  onSearch,
}: Props) {
  return (
    <div className="filters">
      <div className="filter-row">
        <span className="filter-label">Provider</span>
        <div className="chips">
          {providers.length === 0 ? (
            <span className="muted">—</span>
          ) : (
            providers.map((p) => (
              <button
                key={p}
                type="button"
                className={`chip ${selectedProviders.has(p) ? "active" : ""}`}
                onClick={() => onToggleProvider(p)}
              >
                {p}
              </button>
            ))
          )}
        </div>
      </div>
      <div className="filter-row">
        <span className="filter-label">Kind</span>
        <div className="chips">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              className={`chip kind-${k} ${selectedKinds.has(k) ? "active" : ""}`}
              onClick={() => onToggleKind(k)}
            >
              {k}
            </button>
          ))}
        </div>
      </div>
      <div className="filter-row filter-row-end">
        <label className="toggle">
          <input
            type="checkbox"
            checked={needsDecisionOnly}
            onChange={onToggleNeedsDecision}
          />
          <span>Needs decision</span>
        </label>
        <input
          className="search"
          type="search"
          placeholder="Search summaries…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
    </div>
  );
}
