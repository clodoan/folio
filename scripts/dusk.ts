import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { dayInPT } from "../src/schema.ts";
import { loadFolioConfig } from "./folio-config.ts";
import { harvestOnce } from "./harvest.ts";
import { writeFolioLetter } from "./folio-letter.ts";
import { notifyLetter } from "./notify.ts";
import { deliveredFlag } from "./paths.ts";
import { readDayEvents } from "./writeSummary.ts";

function parts(timeZone: string): { minutes: number; weekday: number } {
  const now = new Date();
  const hour = Number.parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(now),
    10,
  );
  const minute = Number.parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone, minute: "2-digit" }).format(now),
    10,
  );
  const wd = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(now);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const h = hour === 24 ? 0 : hour;
  return { minutes: h * 60 + (Number.isFinite(minute) ? minute : 0), weekday: map[wd] ?? 1 };
}

function inEveningWindow(minutes: number): boolean {
  return minutes >= 17 * 60 + 30 && minutes <= 19 * 60;
}

function markDelivered(day: string): void {
  const p = deliveredFlag(day);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, "1\n", "utf8");
}

const cfg = loadFolioConfig();
const force = process.env.FOLIO_DUSK_FORCE === "1";
const now = parts(cfg.timezone);
const day = dayInPT(new Date());
const weekend = now.weekday === 0 || now.weekday === 6;

harvestOnce();

if (!force && !inEveningWindow(now.minutes)) {
  process.exit(0);
}

if (existsSync(deliveredFlag(day))) {
  process.exit(0);
}

if (weekend) {
  const events = readDayEvents(day);
  const sessions = new Set(events.map((e) => e.sessionId));
  if (sessions.size === 0) process.exit(0);
}

const out = writeFolioLetter(day);
if (out.silent) {
  process.exit(0);
}

const openPath = out.homePdf || out.pdfPath || out.homePng || out.pngPath || "";
notifyLetter({ day: out.day, body: out.opening, openPath });
markDelivered(day);
console.log(`dusk delivered ${day}`);
console.log(out.opening);
