import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { cpSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = resolve(ROOT, "data");

function ledgerDataPlugin(): Plugin {
  const mime: Record<string, string> = {
    ".jsonl": "application/jsonl; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".json": "application/json; charset=utf-8",
  };
  return {
    name: "ledger-data",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "";
        const pathname = url.split("?")[0] ?? "";
        if (!pathname.startsWith("/data/")) {
          next();
          return;
        }
        const rel = decodeURIComponent(pathname.slice("/data/".length));
        const abs = normalize(resolve(DATA_ROOT, rel));
        if (relative(DATA_ROOT, abs).startsWith("..") || !abs.startsWith(DATA_ROOT)) {
          res.statusCode = 403;
          res.end("forbidden");
          return;
        }
        if (!existsSync(abs) || !statSync(abs).isFile()) {
          res.statusCode = 404;
          res.end("not found");
          return;
        }
        const type = mime[extname(abs).toLowerCase()] ?? "application/octet-stream";
        res.setHeader("content-type", type);
        res.setHeader("cache-control", "no-store");
        res.end(readFileSync(abs));
      });
    },
    closeBundle() {
      const distData = resolve(ROOT, "dist/data");
      mkdirSync(distData, { recursive: true });
      for (const sub of ["days", "summaries", "samples"]) {
        const src = join(DATA_ROOT, sub);
        if (existsSync(src)) cpSync(src, join(distData, sub), { recursive: true });
      }
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), ledgerDataPlugin()],
  publicDir: "public",
  server: {
    proxy: {
      "/api": "http://127.0.0.1:4173",
    },
  },
});
