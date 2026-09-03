import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT } from "./paths.ts";
import { FOLIO_CONFIG_PATH, writeFolioConfig } from "./folio-config.ts";

function xml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function plist(opts: {
  label: string;
  args: string[];
  keepAlive?: boolean;
  intervals?: { hour: number; minute: number }[];
  log: string;
}): string {
  const args = opts.args.map((a) => `    <string>${xml(a)}</string>`).join("\n");
  let extra = "";
  if (opts.keepAlive) {
    extra += "  <key>KeepAlive</key>\n  <true/>\n  <key>RunAtLoad</key>\n  <true/>\n";
  }
  if (opts.intervals) {
    const dicts = opts.intervals
      .map(
        (i) =>
          `    <dict><key>Hour</key><integer>${i.hour}</integer><key>Minute</key><integer>${i.minute}</integer></dict>`,
      )
      .join("\n");
    extra += `  <key>StartCalendarInterval</key>\n  <array>\n${dicts}\n  </array>\n`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${xml(opts.label)}</string>
  <key>WorkingDirectory</key>
  <string>${xml(ROOT)}</string>
  <key>ProgramArguments</key>
  <array>
${args}
  </array>
${extra}  <key>StandardOutPath</key>
  <string>${xml(opts.log)}</string>
  <key>StandardErrorPath</key>
  <string>${xml(opts.log)}</string>
</dict>
</plist>
`;
}

function eveningSlots(): { hour: number; minute: number }[] {
  const out: { hour: number; minute: number }[] = [];
  for (let m = 17 * 60 + 30; m <= 19 * 60; m += 15) {
    out.push({ hour: Math.floor(m / 60), minute: m % 60 });
  }
  return out;
}

const cfg = writeFolioConfig();
const node = process.execPath;
const tsx = join(ROOT, "node_modules/tsx/dist/cli.mjs");
const agents = join(homedir(), "Library/LaunchAgents");
const logDir = join(homedir(), ".folio");
mkdirSync(logDir, { recursive: true });

console.log(`wrote ${FOLIO_CONFIG_PATH}`);
console.log(`name=${cfg.name} timezone=${cfg.timezone}`);

if (process.platform !== "darwin") {
  console.log("LaunchAgent skipped (Mac only v1).");
  process.exit(0);
}

mkdirSync(agents, { recursive: true });
const duskPlist = join(agents, "com.folio.dusk.plist");
const watchPlist = join(agents, "com.folio.watch.plist");

writeFileSync(
  duskPlist,
  plist({
    label: "com.folio.dusk",
    args: [node, tsx, join(ROOT, "scripts/dusk.ts")],
    intervals: eveningSlots(),
    log: join(logDir, "dusk.log"),
  }),
  "utf8",
);

writeFileSync(
  watchPlist,
  plist({
    label: "com.folio.watch",
    args: [node, tsx, join(ROOT, "scripts/watch.ts")],
    keepAlive: true,
    log: join(logDir, "watch.log"),
  }),
  "utf8",
);

for (const p of [duskPlist, watchPlist]) {
  spawnSync("launchctl", ["unload", p], { stdio: "ignore" });
  const r = spawnSync("launchctl", ["load", "-w", p], { encoding: "utf8" });
  if (r.status !== 0) {
    console.error(`launchctl load failed for ${p}: ${(r.stderr || r.stdout || "").trim()}`);
  } else {
    console.log(`loaded ${p}`);
  }
}

console.log("Folio is watching. Evening letter at dusk.");
