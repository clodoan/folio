import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

function which(bin: string): boolean {
  const r = spawnSync("command", ["-v", bin], { encoding: "utf8" });
  return r.status === 0 && Boolean((r.stdout || "").trim());
}

function apple(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function notifyLetter(opts: { day: string; body: string; openPath: string }): void {
  if (process.platform !== "darwin") {
    console.log(`folio notify ${opts.day}: ${opts.body}`);
    return;
  }
  const target = existsSync(opts.openPath) ? opts.openPath : "";
  if (which("terminal-notifier")) {
    const args = ["-title", opts.day, "-message", opts.body];
    if (target) args.push("-open", `file://${target}`, "-activate", "Preview");
    spawnSync("terminal-notifier", args, { stdio: "ignore" });
    return;
  }
  spawnSync(
    "osascript",
    ["-e", `display notification "${apple(opts.body)}" with title "${apple(opts.day)}"`],
    { stdio: "ignore" },
  );
  if (target) {
    spawnSync("open", ["-a", "Preview", target], { stdio: "ignore" });
  }
}

export function openPreview(filePath: string): void {
  if (process.platform !== "darwin") return;
  if (!existsSync(filePath)) return;
  spawnSync("open", ["-a", "Preview", filePath], { stdio: "inherit" });
}
