import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, Menu, Tray, nativeImage } from "electron";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
let mainWindow = null;
let tray = null;
let daemon = null;
let quitting = false;

function startDaemon() {
  if (daemon) return;
  const script = join(ROOT, "scripts/serve.ts");
  const tsxCli = join(ROOT, "node_modules/tsx/dist/cli.mjs");
  const args = existsSync(tsxCli)
    ? [tsxCli, script]
    : ["--import", "tsx", script];
  daemon = spawn("node", args, {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, LEDGER_PORT: process.env.LEDGER_PORT ?? "4173" },
  });
  daemon.on("exit", (code, signal) => {
    console.log(`ledger daemon exited code=${code} signal=${signal ?? ""}`);
    daemon = null;
  });
}

function stopDaemon() {
  if (!daemon) return;
  daemon.kill("SIGTERM");
  daemon = null;
}

function showWindow() {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    title: "Ledger",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  const index = join(ROOT, "dist/index.html");
  void mainWindow.loadFile(index, { query: { api: "http://127.0.0.1:4173" } });
  mainWindow.on("close", (e) => {
    if (!quitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createTray() {
  const iconPath = join(ROOT, "electron/tray.png");
  const image = nativeImage.createFromPath(iconPath);
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
  tray.setToolTip("Ledger");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Show", click: () => showWindow() },
      {
        label: "Summarize today",
        click: () => {
          const port = process.env.LEDGER_PORT ?? "4173";
          void fetch("http://127.0.0.1:" + port + "/api/summarize", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "{}",
          }).catch((err) => console.error(err));
          showWindow();
        },
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("click", () => showWindow());
}

app.on("before-quit", () => {
  quitting = true;
  stopDaemon();
});

app.whenReady().then(() => {
  startDaemon();
  createTray();
  createWindow();
});

app.on("window-all-closed", () => {
  // keep watching; quit from tray
});

app.on("activate", () => showWindow());
