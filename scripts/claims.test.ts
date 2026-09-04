type SecretCase = {
  path: string;
  secret: boolean;
};

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { composePage, PAPER } from "../folio-hand/src/page.js";
import { AGENT_KINDS } from "../src/agents.ts";
import { breathLines, composeLetter, stanzaLines } from "../src/letter.ts";
import type { LedgerEvent } from "../src/schema.ts";
import { dayInTz } from "../src/schema.ts";
import { inEveningWindow } from "./dusk.ts";
import { isGrokSessionFile, isSecretPath, specForPath } from "./watchTargets.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const event = (partial: Partial<LedgerEvent> & Pick<LedgerEvent, "id" | "summary">): LedgerEvent => ({
  ts: "2026-09-03T18:00:00.000Z",
  day: "2026-09-03",
  provider: "grok",
  agent: "grok",
  sessionId: "sess-1",
  kind: "message",
  role: "user",
  ...partial,
});

test("secret names include credentials", () => {
  const cases: SecretCase[] = [
    { path: "/Users/ada/.grok/auth.json", secret: true },
    { path: "/tmp/cookies.json", secret: true },
    { path: "/tmp/session-token.json", secret: true },
    { path: "/tmp/secret.json", secret: true },
    { path: "/tmp/credentials.json", secret: true },
    { path: "/tmp/mcp_credentials.json", secret: true },
    { path: "/Users/ada/.grok/sessions/s/updates.jsonl", secret: false },
  ];
  for (const c of cases) {
    assert.equal(isSecretPath(c.path), c.secret, c.path);
  }
});

test("grok harvest accepts only the conversation files", () => {
  const session = "/Users/ada/.grok/sessions/s";
  assert.equal(isGrokSessionFile(`${session}/updates.jsonl`), true);
  assert.equal(isGrokSessionFile(`${session}/rewind.jsonl`), false);
  assert.equal(isGrokSessionFile(`${session}/terminal.log`), false);
  assert.equal(isGrokSessionFile(`${session}/auth.json`), false);
  assert.equal(isGrokSessionFile(`${session}/notes.txt`), false);
});

test("letter is silent when topics cannot be extracted", () => {
  const empty = composeLetter("2026-09-03", [], { name: "Ada" });
  assert.equal(empty.silent, true);

  const noNoun = composeLetter(
    "2026-09-03",
    [event({ id: "1", summary: "how does this work", role: "user", kind: "message" })],
    { name: "Ada" },
  );
  assert.equal(noNoun.silent, true);

  const withTopic = composeLetter(
    "2026-09-03",
    [event({ id: "2", summary: "fix the letter export", role: "user", kind: "message" })],
    { name: "Ada" },
  );
  assert.equal(withTopic.silent, false);
  assert.match(withTopic.opening, /letter/);
});

test("agent registry is the list harvest probes, grok first", () => {
  const ids = AGENT_KINDS.map((k) => k.id);
  assert.deepEqual(ids, [
    "grok",
    "claude",
    "cursor",
    "codex",
    "gemini",
    "opencode",
    "continue",
    "goose",
    "amp",
    "crush",
    "cline",
    "copilot",
    "factory",
    "aider",
  ]);
});

test("harvest path does not fetch product clouds", () => {
  const files = [
    "scripts/harvest.ts",
    "scripts/watcher.ts",
    "scripts/watchTargets.ts",
    "scripts/ingest.ts",
    "src/ingestParse.ts",
  ];
  const banned = /https?:\/\/([a-z0-9.-]+\.)?(cursor\.com|grok\.com|x\.ai|anthropic\.com|openai\.com)/i;
  for (const rel of files) {
    const text = readFileSync(join(root, rel), "utf8");
    assert.equal(banned.test(text), false, rel);
  }
});

test("dusk window is 5:30pm to 7:00pm", () => {
  assert.equal(inEveningWindow(17 * 60 + 29), false);
  assert.equal(inEveningWindow(17 * 60 + 30), true);
  assert.equal(inEveningWindow(19 * 60), true);
  assert.equal(inEveningWindow(19 * 60 + 1), false);
});

test("day key follows the given timezone", () => {
  const instant = "2026-09-04T04:30:00.000Z";
  assert.equal(dayInTz(instant, "America/New_York"), "2026-09-04");
  assert.equal(dayInTz(instant, "America/Los_Angeles"), "2026-09-03");
});

test("watch matching stays inside the spec root", () => {
  const rewind = "/Users/ada/.grok/sessions/s/rewind_points.jsonl";
  const updates = "/Users/ada/.grok/sessions/s/updates.jsonl";
  const specs = [
    { root: "/Users/ada/.grok/sessions", label: "Grok", accept: isGrokSessionFile },
    {
      root: "/Users/ada/.claude/projects",
      label: "Claude",
      accept: (abs: string) => abs.endsWith(".jsonl") && !isSecretPath(abs),
    },
  ];
  assert.equal(specForPath(specs, rewind), undefined);
  assert.equal(specForPath(specs, updates)?.label, "Grok");
});

test("harvest and watcher both dispatch through specForPath", () => {
  const harvest = readFileSync(join(root, "scripts/harvest.ts"), "utf8");
  const watcher = readFileSync(join(root, "scripts/watcher.ts"), "utf8");
  assert.match(harvest, /specForPath\(\[spec\], abs\)/);
  assert.match(watcher, /specForPath\(allow, abs\)/);
  assert.equal(/allow\.find\(\(s\) => s\.accept\(abs\)\)/.test(watcher), false);
});

test("now and dusk share the delivered flag and purge after it", () => {
  const now = readFileSync(join(root, "scripts/folio-now.ts"), "utf8");
  const dusk = readFileSync(join(root, "scripts/dusk.ts"), "utf8");
  assert.match(now, /markDelivered\(out\.day\)/);
  assert.match(dusk, /markDelivered\(day\)/);
  assert.match(now, /purgeDayScratch\(out\.day\)/);
  assert.match(dusk, /purgeDayScratch\(day\)/);
  assert.equal(/weekday === 0/.test(dusk), false);
});

test("breathLines keeps short lines whole and splits long ones at a pause", () => {
  assert.deepEqual(breathLines("the page holds the hour"), ["the page holds the hour"]);
  const lines = breathLines("fix the letter export before dusk and keep the page from ever clipping");
  assert.equal(lines.length, 2);
  assert.match(lines[0], /,$/);
  for (const line of lines) assert.equal(line.length <= 64, true, line);
});

test("a full day reads as a longer poem, bounded for one page", () => {
  const sessions: [string, string][] = [
    ["s1", "fix the letter export before dusk so nothing waits on the margin"],
    ["s2", "update the watch so the harvest lands in one clean file"],
    ["s3", "build the timeline for the evening page and keep it quiet"],
    ["s4", "sync the config with the machine timezone and write it down"],
    ["s5", "refactor the ingest so grok sessions land first class"],
  ];
  const events = sessions.map(([sessionId, text], i) =>
    event({ id: `p${i}`, sessionId, summary: text }),
  );
  const letter = composeLetter("2026-09-03", events, { name: "Ada" });
  assert.equal(letter.silent, false);
  assert.equal(letter.stanzas.length >= 5, true);
  const lines = stanzaLines(letter);
  assert.equal(lines.length >= 7, true);
  assert.equal(lines.length <= 12, true);
  for (const line of lines) {
    assert.equal(line.length <= 64, true, line);
    assert.equal(line, line.toLowerCase(), line);
  }
});

test("a long poem still writes one A5 page without clipping", () => {
  const sessions: [string, string][] = [
    ["s1", "fix the letter export before dusk so nothing waits on the margin"],
    ["s2", "update the watch so the harvest lands in one clean file"],
    ["s3", "build the timeline for the evening page and keep it quiet"],
    ["s4", "sync the config with the machine timezone and write it down"],
    ["s5", "refactor the ingest so grok sessions land first class"],
    ["s6", "scaffold the fixtures so a stranger sees a letter tonight"],
  ];
  const events = sessions.map(([sessionId, text], i) =>
    event({ id: `q${i}`, sessionId, summary: text }),
  );
  const letter = composeLetter("2026-09-03", events, { name: "Ada" });
  const page = composePage(
    {
      day: letter.day,
      name: letter.name,
      opening: letter.opening,
      stanzas: stanzaLines(letter),
      close: letter.close,
      initials: letter.initials,
    },
    letter.day,
  );
  for (const r of page.inkRibbons) {
    for (const [x, y] of r.polygon) {
      assert.equal(x >= 2 && x <= PAPER.wMm - 2, true, `x ${x}`);
      assert.equal(y >= 2 && y <= PAPER.hMm - 2, true, `y ${y}`);
    }
  }
});

test("folio off disables and removes the LaunchAgents", () => {
  const off = readFileSync(join(root, "scripts/folio-off.ts"), "utf8");
  assert.match(off, /"unload", "-w"/);
  assert.match(off, /unlinkSync/);
});

test("readme says no dashboard and the window is gone", () => {
  const readme = readFileSync(join(root, "README.md"), "utf8");
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    main?: string;
    scripts?: Record<string, string>;
  };
  assert.match(readme, /No dashboard/);
  assert.equal(/leftover Ledger/.test(readme), false);
  assert.equal(/No sessions that day/.test(readme), false);
  assert.equal(/never reads/.test(readme), false);
  assert.equal(pkg.scripts?.start, undefined);
  assert.equal(pkg.scripts?.serve, undefined);
  assert.equal(pkg.scripts?.electron, undefined);
  assert.equal(pkg.scripts?.app, undefined);
  assert.equal(pkg.main, undefined);
  assert.equal(existsSync(join(root, "src/App.tsx")), false);
  assert.equal(existsSync(join(root, "scripts/serve.ts")), false);
  assert.equal(existsSync(join(root, "electron/main.mjs")), false);
  assert.equal(existsSync(join(root, "src/activity.ts")), false);
  assert.equal(existsSync(join(root, "src/grouping.ts")), false);
  const watch = readFileSync(join(root, "scripts/watchTargets.ts"), "utf8");
  assert.equal(/LEDGER_WATCH/.test(watch), false);
  assert.equal(/WATCH_CONFIG/.test(watch), false);
});
