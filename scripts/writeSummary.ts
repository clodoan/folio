import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseDayJsonl } from "../src/schema.ts";
import { summarizeDay } from "../src/summarize.ts";
import { DATA_DAYS, DATA_SUMMARIES } from "./paths.ts";

export function readDayEvents(day: string) {
  const path = `${DATA_DAYS}/${day}.jsonl`;
  if (!existsSync(path)) return [];
  return parseDayJsonl(readFileSync(path, "utf8"));
}

export function writeDaySummary(day: string): string {
  const events = readDayEvents(day);
  const md = summarizeDay(day, events);
  mkdirSync(DATA_SUMMARIES, { recursive: true });
  writeFileSync(`${DATA_SUMMARIES}/${day}.md`, md, "utf8");
  return md;
}
