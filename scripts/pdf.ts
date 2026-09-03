import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { pathToFileURL } from "node:url";

const CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "google-chrome",
  "chromium",
  "chromium-browser",
].filter((x): x is string => Boolean(x));

function which(bin: string): string | null {
  if (bin.includes("/") && existsSync(bin)) return bin;
  const r = spawnSync("command", ["-v", bin], { encoding: "utf8" });
  const p = (r.stdout || "").trim();
  return p && existsSync(p) ? p : null;
}

export function findChrome(): string | null {
  for (const c of CANDIDATES) {
    const hit = which(c);
    if (hit) return hit;
  }
  const mac = `${homedir()}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`;
  if (existsSync(mac)) return mac;
  return null;
}

export function htmlToPdf(htmlPath: string, pdfPath: string): { ok: boolean; chrome: string | null; error?: string } {
  const chrome = findChrome();
  if (!chrome) return { ok: false, chrome: null, error: "no chrome" };
  const fileUrl = pathToFileURL(htmlPath).href;
  const base = [
    "--headless=new",
    "--disable-gpu",
    "--no-pdf-header-footer",
    `--print-to-pdf=${pdfPath}`,
    fileUrl,
  ];
  const attempts = process.platform === "darwin" ? [base, ["--no-sandbox", ...base]] : [["--no-sandbox", ...base], base];
  let last = "";
  for (const args of attempts) {
    const r = spawnSync(chrome, args, { encoding: "utf8" });
    last = (r.stderr || r.stdout || "").slice(-400);
    if (r.status === 0 && existsSync(pdfPath)) return { ok: true, chrome };
  }
  return { ok: false, chrome, error: last || "print failed" };
}
