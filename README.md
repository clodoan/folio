# Folio

An evening letter from your agents.

Folio reads the agent traces already on this machine and at dusk writes one handwritten A5 page. No account. No scrape. The letter is the product.

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

Setup writes `~/.folio/config.json` and loads a harvest watcher plus a dusk check every evening from 5:30 to 7:00 in the timezone in that file. `folio:now` harvests, writes today's letter, and opens it in Preview when there is something to say.

## Use it with your agents

Folio watches known agent homes that exist on disk. The list lives in `src/agents.ts`. It includes Claude, Grok, Cursor, Codex, Gemini, and several others. A missing home is skipped.

Add a `watch` directory in config, or drop a file into `inbox/` for anything else. Inbox takes top-level `.json` and `.jsonl` only.

No API keys. Harvest skips files named like secrets (`auth.json`, cookies, tokens, credentials). It does not scrape the web. Grok harvest takes conversation files only. Transcript bodies can still hold what you typed.

Put your name in config so the opening sentence uses it:

```json
{
  "name": "Ada",
  "timezone": "America/Los_Angeles",
  "watch": ["~/path/to/more/jsonl"]
}
```

Letters land at `~/Documents/Folio/letters/YYYY-MM-DD.pdf` (and `.png`). The dusk notification is the opening sentence. On a stock Mac, Preview opens with the letter. Click-to-open needs `terminal-notifier`.

If the day has no usable topics, Folio stays quiet. No ping.

## The hand

Paths, not a font. A few key points per letter, join tags, Chaikin smoothing, a thin ribbon. Each night the same person writes a new page.

## Uninstall

```bash
npm run folio:off
```

That unloads and removes the LaunchAgents. Delete `~/.folio` and `~/Documents/Folio` if you want those gone too.

## Privacy

Everything stays on the machine. Harvest and watch share one allowlist. Day JSONL in `data/days` is local scratch and is gitignored.

A leftover Ledger window still lives in the repo (`npm start`). Setup does not start it.

MIT.
