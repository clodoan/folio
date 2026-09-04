import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const fixtures = join(root, "fixtures");

// Point every home at a sandbox seeded from fixtures. The app modules read
// HOME at import time for ~/.folio, so they load after this block on purpose.
const fakeHome = mkdtempSync(join(tmpdir(), "folio-fixture-home-"));
process.env.HOME = fakeHome;
process.env.USERPROFILE = fakeHome;
process.env.GROK_HOME = join(fakeHome, ".grok");
mkdirSync(join(fakeHome, ".claude"), { recursive: true });
cpSync(join(fixtures, "claude-code", "projects"), join(fakeHome, ".claude", "projects"), { recursive: true });
cpSync(join(fixtures, "grok"), join(fakeHome, ".grok"), { recursive: true });
mkdirSync(join(fakeHome, ".folio"), { recursive: true });
writeFileSync(
  join(fakeHome, ".folio", "config.json"),
  JSON.stringify({ name: "Ada", timezone: "UTC", watch: [] }) + "\n",
  "utf8",
);

const { resolveWatchSpecs } = await import("./watchTargets.ts");
const { harvestFiles, harvestOnce } = await import("./harvest.ts");
const { DATA_DAYS, INBOX_DIR, purgeDayScratch } = await import("./paths.ts");
const { loadFolioConfig, systemTimezone } = await import("./folio-config.ts");
const { dayInTz, parseDayJsonl } = await import("../src/schema.ts");
const { composeLetter } = await import("../src/letter.ts");

const readDayEvents = (day: string) => {
  const p = join(DATA_DAYS, `${day}.jsonl`);
  return existsSync(p) ? parseDayJsonl(readFileSync(p, "utf8")) : [];
};

harvestOnce();

test("config timezone follows the machine, LA only as last resort", () => {
  assert.equal(loadFolioConfig().timezone, "UTC");
  const detected = systemTimezone();
  const host = Intl.DateTimeFormat().resolvedOptions().timeZone;
  assert.equal(detected, host && host.trim() ? host : "America/Los_Angeles");
});

test("watch specs cover the fixture agent homes", () => {
  const specs = resolveWatchSpecs();
  assert.equal(specs.some((s) => s.label === "inbox"), true);
  assert.equal(specs.some((s) => s.provider === "claude"), true);
  assert.equal(specs.some((s) => s.provider === "grok"), true);
  assert.equal(specs.some((s) => s.provider === "codex"), false);
});

test("harvest takes transcripts and leaves secrets and side logs", () => {
  const files = harvestFiles();
  assert.equal(files.some((f) => f.endsWith("f0dcbe1e-3a3e-4c47-9464-2fa1f9023c7b.jsonl")), true);
  assert.equal(files.some((f) => f.endsWith("updates.jsonl")), true);
  assert.equal(files.some((f) => f.endsWith("chat_history.jsonl")), true);
  assert.equal(files.some((f) => f.includes("rewind_points")), false);
  assert.equal(files.some((f) => f.endsWith("auth.json")), false);
  assert.equal(files.some((f) => f.endsWith("summary.json")), false);
});

test("claude code sessions land as ledger events", () => {
  const claude = readDayEvents("2026-09-03").filter((e) => e.provider === "claude");
  const user = claude.find((e) => e.kind === "message" && e.role === "user");
  assert.equal(user?.sessionId, "f0dcbe1e-3a3e-4c47-9464-2fa1f9023c7b");
  assert.match(user?.summary ?? "", /letter export/);
  assert.equal(claude.some((e) => e.kind === "tool"), true);
  assert.equal(claude.some((e) => /caveat/i.test(e.summary)), false);
});

test("grok bot sessions land as ledger events", () => {
  const grok = readDayEvents("2026-09-03").filter((e) => e.provider === "grok");
  const acp = grok.find(
    (e) => e.sessionId === "019910c4-6f57-7bd2-8dd2-015bb3f0f2a7" && e.role === "user",
  );
  assert.match(acp?.summary ?? "", /grok harvest/);
  assert.equal(grok.some((e) => e.kind === "tool" && /read_file/.test(e.summary)), true);
  const tui = grok.find(
    (e) => e.sessionId === "0198aaaa-bbbb-7ccc-8ddd-0123456789ab" && e.role === "user",
  );
  assert.match(tui?.summary ?? "", /watch on the evening page/);
  assert.equal(tui?.ts.startsWith("2026-09-03"), true);
});

test("a fixture day composes a non-silent poem", () => {
  const events = readDayEvents("2026-09-03");
  const letter = composeLetter("2026-09-03", events, { name: "Ada" });
  assert.equal(letter.silent, false);
  assert.equal(letter.stanzas.length >= 2, true);
});

test("harvest is idempotent on unchanged files", () => {
  const before = readDayEvents("2026-09-03").length;
  assert.equal(harvestOnce(), 0);
  assert.equal(readDayEvents("2026-09-03").length, before);
});

test("the grok demo fixture in inbox writes today's letter", () => {
  const dest = join(INBOX_DIR, "grok-bot-demo.fixture-test.jsonl");
  cpSync(join(root, "docs", "fixtures", "grok-bot-demo.jsonl"), dest);
  try {
    harvestOnce();
    const today = dayInTz(new Date(), "UTC");
    const demo = readDayEvents(today).filter((e) => e.provider === "grok" && e.sessionId.startsWith("demo-"));
    assert.equal(demo.length >= 8, true);
    const letter = composeLetter(today, demo, { name: "Ada" });
    assert.equal(letter.silent, false);
    assert.equal(letter.stanzas.length >= 3, true);
  } finally {
    unlinkSync(dest);
  }
});

test("delivery purges that day's scratch and older days", () => {
  const today = dayInTz(new Date(), "UTC");
  writeFileSync(join(DATA_DAYS, "2026-08-30.jsonl"), "{}\n", "utf8");
  assert.equal(existsSync(join(DATA_DAYS, "2026-09-03.jsonl")), true);
  const removed = purgeDayScratch(today);
  assert.equal(removed.includes("2026-08-30"), true);
  assert.equal(removed.includes("2026-09-03"), true);
  assert.equal(removed.includes(today), true);
  assert.equal(existsSync(join(DATA_DAYS, "2026-09-03.jsonl")), false);
  assert.equal(existsSync(join(fakeHome, ".folio", "config.json")), true);
  assert.deepEqual(purgeDayScratch(today), []);
});
