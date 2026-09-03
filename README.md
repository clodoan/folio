# Folio

An evening letter from your agents.

Folio sits in the background, reads local agent traces, and at dusk writes one handwritten A5 page. No dashboard. No account. No cloud.

![A sample Folio letter](docs/letter.png)

## Install

Mac for now (Preview + LaunchAgents). Node 20+.

```bash
git clone https://github.com/clodoan/folio.git
cd folio
npm i
npm run folio:setup
npm run folio:now
```

Setup writes `~/.folio/config.json` and loads a harvest watcher plus a dusk check (weekdays, after 5:30 local, cap 7:00). `folio:now` harvests today and opens the letter.

## Use it with your agents

By default Folio watches:

- `~/.cursor/projects/*/agent-transcripts/**/*.jsonl` (Cursor local agents)
- `inbox/` in the checkout — drop an export `.jsonl` here for anything else

No API keys. It never reads `auth.json`, cookies, or tokens.

Put your name in config so the opening sentence is yours:

```json
{
  "name": "Ada",
  "timezone": "America/Los_Angeles",
  "watch": ["~/path/to/more/jsonl"]
}
```

Letters land at `~/Documents/Folio/letters/YYYY-MM-DD.pdf` (and `.png`). The notification is the first sentence. Click opens Preview.

No sessions that day → silence. No ping.

## The hand

Paths, not a font. A few key points per letter, join tags, Chaikin smoothing, a thin ribbon. Each night the same person writes a new page.

## Uninstall

```bash
npm run folio:off
```

Then delete `~/.folio` and `~/Documents/Folio` if you want them gone.

## Privacy

Everything stays on the machine. Harvest is an allowlist. Day JSONL in `data/days` is local scratch and is gitignored.

MIT.
