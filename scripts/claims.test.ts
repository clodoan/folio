type SecretCase = {
  path: string;
  secret: boolean;
};

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { AGENT_KINDS } from "../src/agents.ts";
import { composeLetter } from "../src/letter.ts";
import type { LedgerEvent } from "../src/schema.ts";
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
  const empty = composeLetter("2026-09-03", [], { name: "Ada", timezone: "America/Los_Angeles" });
  assert.equal(empty.silent, true);

  const noNoun = composeLetter(
    "2026-09-03",
    [event({ id: "1", summary: "how does this work", role: "user", kind: "message" })],
    { name: "Ada", timezone: "America/Los_Angeles" },
  );
  assert.equal(noNoun.silent, true);

  const withTopic = composeLetter(
    "2026-09-03",
    [event({ id: "2", summary: "fix the letter export", role: "user", kind: "message" })],
    { name: "Ada", timezone: "America/Los_Angeles" },
  );
  assert.equal(withTopic.silent, false);
  assert.match(withTopic.opening, /letter/);
});

test("agent registry is the list harvest probes", () => {
  const ids = AGENT_KINDS.map((k) => k.id);
  assert.deepEqual(ids, [
    "cursor",
    "grok",
    "claude",
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

test("dusk window is 5:30pm to 7:00pm and weekends are not a hard skip", () => {
  const dusk = readFileSync(join(root, "scripts/dusk.ts"), "utf8");
  assert.match(dusk, /minutes >= 17 \* 60 \+ 30 && minutes <= 19 \* 60/);
  assert.match(dusk, /weekday === 0 \|\| now\.weekday === 6/);
  assert.match(dusk, /if \(sessions\.size === 0\) process\.exit\(0\)/);
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

test("folio off disables and removes the LaunchAgents", () => {
  const off = readFileSync(join(root, "scripts/folio-off.ts"), "utf8");
  assert.match(off, /"unload", "-w"/);
  assert.match(off, /unlinkSync/);
});

test("readme and setup do not deny the leftover Ledger window", () => {
  const readme = readFileSync(join(root, "README.md"), "utf8");
  const setup = readFileSync(join(root, "scripts/folio-setup.ts"), "utf8");
  assert.equal(readme.includes("No dashboard"), false);
  assert.equal(setup.includes("No dashboard"), false);
  assert.equal(/No sessions that day/.test(readme), false);
  assert.equal(/never reads/.test(readme), false);
});
