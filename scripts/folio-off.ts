import { existsSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const agents = join(homedir(), "Library/LaunchAgents");
const files = [join(agents, "com.folio.dusk.plist"), join(agents, "com.folio.watch.plist")];

if (process.platform !== "darwin") {
  console.log("folio:off is Mac-only.");
  process.exit(0);
}

for (const p of files) {
  const r = spawnSync("launchctl", ["unload", "-w", p], { encoding: "utf8" });
  if (r.status === 0) console.log(`unloaded ${p}`);
  else console.log(`unload ${p}: ${(r.stderr || r.stdout || "ok").trim() || "done"}`);
  if (existsSync(p)) {
    unlinkSync(p);
    console.log(`removed ${p}`);
  }
}
