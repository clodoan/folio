# Folio

An evening letter from your agents.

Folio reads the agent traces already on this machine and at dusk writes one handwritten A5 page. No account. No scrape. No dashboard. The letter is the product.

![A sample Folio letter](docs/letter.png)

## Install

Mac is the supported install. It uses Preview and LaunchAgents. Node 20+. Harvest and the letter also run on other systems if you call them yourself.

```bash
git clone https://github.com/clodoan/folio.git
cd folio
npm i
npm run folio:setup
npm run folio:now
```

Setup detects this machine's timezone and writes it to `~/.folio/config.json`. `America/Los_Angeles` is the last resort when detection fails. Setup loads a harvest watcher plus a dusk check every evening from 5:30 to 7:00. LaunchAgent fire times follow this Mac's clock. The letter window and the day key use the timezone in config. `folio:now` harvests, writes today's letter, opens it in Preview when there is something to say, and marks that day delivered.

The LaunchAgents pin this clone's absolute path. If you move the folder, run `npm run folio:setup` again.

## See a letter in two minutes

No agents installed yet? Use the demo fixture.

```bash
cp docs/fixtures/grok-bot-demo.jsonl inbox/
npm run folio:now
```

The demo lands on today. The letter opens in Preview. Delete the file from `inbox/` when you are done.

## Use it with your agents

Folio watches known agent homes that exist on disk. The list lives in `src/agents.ts`. A missing home is skipped.

These homes are exercised end to end by fixture tests:

- Grok Bot / Grok TUI: `~/.grok/sessions` (or `$GROK_HOME/sessions`). Conversation files only: `updates.jsonl`, `events.jsonl`, `chat_history.jsonl`, or a lone `summary.json`.
- Claude Code: `~/.claude/projects/<project>/<session>.jsonl`.
- Cursor: agent transcripts under `~/.cursor/projects`.

Codex, Gemini, OpenCode, Continue, Goose, Amp, Crush, Cline, Copilot, Factory, and Aider are probed as plain `.jsonl` session homes.

Add a `watch` directory in config, or drop a file into `inbox/` for anything else. Inbox takes top-level `.json` and `.jsonl` only. A file named like `grok-bot-*.jsonl` parses as a Grok session wherever it lands.

No API keys. Harvest skips files named like secrets (`auth.json`, cookies, tokens, credentials). It does not scrape the web. Grok harvest takes conversation files only. Transcript bodies can still hold what you typed.

Put your name in config so the opening sentence uses it:

```json
{
  "name": "Ada",
  "timezone": "America/New_York",
  "watch": ["~/path/to/more/jsonl"]
}
```

Grok Bot fleet chats on the agent computer live at `/home/box/agent-data/agent-transcripts`, not Mac Application Support. Add that path to `watch`, or run Folio where those files exist, and they get picked up.

Letters land at `~/Documents/Folio/letters/YYYY-MM-DD.pdf` (and `.png`). The dusk notification is the opening sentence. On a stock Mac, Preview opens with the letter. Click-to-open needs `terminal-notifier`.

Machine chrome (UUIDs, scheduled-task lines, call ids, raw URLs) is stripped from topics. If nothing human remains, the day stays quiet. No ping.

## The hand

Paths, not a font. Join tags, Chaikin smoothing, a thin ribbon. Each night the same person writes a new page.

A non-silent day reads as one poem. More sessions mean more stanzas. The hand scales itself so the poem always fits one A5 page.

## Uninstall

```bash
npm run folio:off
```

That unloads and removes the LaunchAgents. Delete `~/.folio` and `~/Documents/Folio` if you want those gone too.

## Privacy

Everything stays on the machine. Harvest and watch share one allowlist. Day JSONL in `~/.folio/days` is local scratch. After a letter is delivered, Folio deletes that day's JSONL and every older one. Config, LaunchAgents, and the letters in Documents stay. Extra watch roots come from `watch` in config.

MIT.
