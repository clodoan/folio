import { useCallback, useEffect, useMemo, useState } from "react";
import type { LedgerEvent } from "./schema";
import { shiftDay } from "./schema";
import {
  fetchApiSummary,
  loadDay,
  loadSummaryFile,
  openEventStream,
  postSummarize,
  probeDaemon,
  todayPT,
} from "./store";
import { downloadText } from "./export";
import { summarizeDay } from "./summarize";
import { DayHeader } from "./components/DayHeader";
import { Timeline } from "./components/Timeline";
import { SummaryPanel } from "./components/SummaryPanel";
import { TodayCard } from "./components/TodayCard";
import { CloudBanner } from "./components/CloudBanner";
import { computeDayActivity } from "./activity";

export default function App() {
  const [day, setDay] = useState(() => todayPT());
  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [daemonUp, setDaemonUp] = useState(false);
  const [summaryMd, setSummaryMd] = useState<string | null>(null);
  const [summarySource, setSummarySource] = useState<"daemon" | "client" | "file" | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [wrotePath, setWrotePath] = useState<string | null>(null);
  const [debug, setDebug] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get("debug") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let cancelled = false;
    let attempt = 0;
    const tick = () => {
      void probeDaemon().then((up) => {
        if (cancelled) return;
        setDaemonUp(up);
        attempt += 1;
        if (!up && attempt < 20) window.setTimeout(tick, 500);
      });
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!daemonUp) return;
    return openEventStream(() => setReloadTick((n) => n + 1));
  }, [daemonUp]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadDay(day)
      .then((ev) => {
        if (cancelled) return;
        setEvents(ev);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setEvents([]);
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [day, reloadTick]);

  useEffect(() => {
    let cancelled = false;
    setSummaryMd(null);
    setSummarySource(null);
    setWrotePath(null);
    (async () => {
      const fromApi = await fetchApiSummary(day);
      if (cancelled) return;
      if (fromApi) {
        setSummaryMd(fromApi);
        setSummarySource("daemon");
        setWrotePath(`data/summaries/${day}.md`);
        return;
      }
      const fromFile = await loadSummaryFile(day);
      if (cancelled) return;
      if (fromFile) {
        setSummaryMd(fromFile);
        setSummarySource("file");
        setWrotePath(`data/summaries/${day}.md`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [day]);

  const activity = useMemo(() => computeDayActivity(events), [events]);
  const isToday = day === todayPT();

  const onWriteEod = useCallback(async () => {
    setSummarizing(true);
    setError(null);
    const target = day;
    try {
      if (daemonUp) {
        const md = await postSummarize(target);
        setSummaryMd(md);
        setSummarySource("daemon");
        setWrotePath(`data/summaries/${target}.md`);
      } else {
        const ev = target === day ? events : await loadDay(target);
        const md = summarizeDay(target, ev);
        setSummaryMd(md);
        setSummarySource("client");
        downloadText(`ledger-summary-${target}.md`, md, "text/markdown");
        setWrotePath(null);
        setError("Ingest is not running — downloaded the summary instead of writing data/summaries.");
      }
      setSummaryOpen(true);
    } catch (err: unknown) {
      const md = summarizeDay(target, events);
      setSummaryMd(md);
      setSummarySource("client");
      downloadText(`ledger-summary-${target}.md`, md, "text/markdown");
      setSummaryOpen(true);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSummarizing(false);
    }
  }, [daemonUp, day, events]);

  const onDownloadSummary = useCallback(() => {
    if (!summaryMd) return;
    downloadText(`ledger-summary-${day}.md`, summaryMd, "text/markdown");
  }, [day, summaryMd]);

  return (
    <div className="app">
      <DayHeader
        day={day}
        isToday={isToday}
        daemonUp={daemonUp}
        summarizing={summarizing}
        hasSummary={Boolean(summaryMd)}
        summaryOpen={summaryOpen}
        onPrev={() => setDay((d) => shiftDay(d, -1))}
        onNext={() => setDay((d) => shiftDay(d, 1))}
        onToday={() => setDay(todayPT())}
        onSummarize={() => {
          void onWriteEod();
        }}
        onToggleSummary={() => setSummaryOpen((v) => !v)}
      />
      <CloudBanner />
      <SummaryPanel
        day={day}
        markdown={summaryMd}
        open={summaryOpen}
        source={summarySource}
        onClose={() => setSummaryOpen(false)}
        onDownload={onDownloadSummary}
      />
      <main className="main">
        {loading ? <p className="muted status">Loading…</p> : null}
        {error ? <p className="error status">{error}</p> : null}
        {!loading ? (
          <TodayCard
            activity={activity}
            day={day}
            writing={summarizing}
            wrotePath={wrotePath}
            onWriteEod={() => {
              void onWriteEod();
            }}
          />
        ) : null}
        <p className="debug-link">
          <button type="button" className="linkish" onClick={() => setDebug((v) => !v)}>
            {debug ? "Hide event debug" : "Debug events"}
          </button>
        </p>
        {debug && !loading ? <Timeline events={events} /> : null}
      </main>
    </div>
  );
}
