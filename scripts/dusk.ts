import { dayInTz } from "../src/schema.ts";
import { loadFolioConfig } from "./folio-config.ts";
import { harvestOnce } from "./harvest.ts";
import { writeFolioLetter } from "./folio-letter.ts";
import { notifyLetter } from "./notify.ts";
import { isDelivered, markDelivered, purgeDayScratch } from "./paths.ts";

export const clockParts = (timeZone: string, now = new Date()): { minutes: number } => {
  const hour = Number.parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(now),
    10,
  );
  const minute = Number.parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone, minute: "2-digit" }).format(now),
    10,
  );
  const h = hour === 24 ? 0 : hour;
  return { minutes: h * 60 + (Number.isFinite(minute) ? minute : 0) };
};

export const inEveningWindow = (minutes: number): boolean =>
  minutes >= 17 * 60 + 30 && minutes <= 19 * 60;

export const runDusk = (opts?: { now?: Date; force?: boolean }): void => {
  const cfg = loadFolioConfig();
  const force = opts?.force ?? process.env.FOLIO_DUSK_FORCE === "1";
  const now = opts?.now ?? new Date();
  const parts = clockParts(cfg.timezone, now);
  const day = dayInTz(now, cfg.timezone);

  harvestOnce();

  if (!force && !inEveningWindow(parts.minutes)) return;
  if (isDelivered(day)) return;

  const out = writeFolioLetter(day);
  if (out.silent) return;

  const openPath = out.homePdf || out.pdfPath || out.homePng || out.pngPath || "";
  notifyLetter({ day: out.day, body: out.opening, openPath });
  markDelivered(day);
  purgeDayScratch(day);
  console.log(`dusk delivered ${day}`);
  console.log(out.opening);
};

const invoked = process.argv[1]?.includes("dusk");
if (invoked) runDusk();
