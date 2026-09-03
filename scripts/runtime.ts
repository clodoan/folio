import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
  type Server,
} from "node:http";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, relative, resolve } from "node:path";
import { dayInPT } from "../src/schema.ts";
import { startWatcher, type WatcherHandle } from "./watcher.ts";
import { writeDaySummary } from "./writeSummary.ts";
import {
  DATA_DAYS,
  DEFAULT_PORT,
  DIST_DIR,
  DATA_SUMMARIES,
  ROOT,
} from "./paths.ts";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jsonl": "application/jsonl; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
};

function send(res: ServerResponse, status: number, body: string | Buffer, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store", ...CORS });
  res.end(body);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolveBody(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function safeJoin(root: string, urlPath: string): string | null {
  const decoded = decodeURIComponent(urlPath.split("?")[0] ?? "");
  const rel = decoded.replace(/^\/+/, "");
  const abs = normalize(resolve(root, rel));
  if (relative(root, abs).startsWith("..") || !abs.startsWith(root)) return null;
  return abs;
}

function fileIfExists(abs: string | null): string | null {
  if (!abs || !existsSync(abs)) return null;
  if (!statSync(abs).isFile()) return null;
  return abs;
}

function resolveStatic(urlPath: string): string | null {
  const pathname = urlPath.split("?")[0] ?? "/";
  if (pathname.startsWith("/data/")) {
    const rel = pathname.slice("/data/".length);
    const fromData = fileIfExists(safeJoin(join(ROOT, "data"), rel));
    if (fromData) return fromData;
  }
  if (pathname === "/" || pathname === "") {
    return fileIfExists(join(DIST_DIR, "index.html"));
  }
  const fromDist = fileIfExists(safeJoin(DIST_DIR, pathname));
  if (fromDist) return fromDist;
  if (!extname(pathname)) return fileIfExists(join(DIST_DIR, "index.html"));
  return null;
}

function dayStats(): Record<string, { mtimeMs: number; size: number }> {
  const out: Record<string, { mtimeMs: number; size: number }> = {};
  const dir = DATA_DAYS;
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".jsonl")) continue;
    const st = statSync(join(dir, name));
    out[name.replace(/\.jsonl$/, "")] = { mtimeMs: st.mtimeMs, size: st.size };
  }
  return out;
}

export type LedgerRuntime = {
  port: number;
  origin: string;
  watcher: WatcherHandle;
  server: Server;
  summarize: (day?: string) => string;
  close: () => Promise<void>;
};

export async function startLedgerRuntime(opts?: {
  port?: number;
  listen?: boolean;
}): Promise<LedgerRuntime> {
  const wanted = opts?.port ?? Number(process.env.LEDGER_PORT ?? DEFAULT_PORT);
  let ingestSeq = 0;
  const sse = new Set<ServerResponse>();

  const ping = () => {
    ingestSeq += 1;
    const payload = `event: ingest\ndata: ${JSON.stringify({ ingestSeq })}\n\n`;
    for (const client of sse) {
      try {
        client.write(payload);
      } catch {
        sse.delete(client);
      }
    }
  };

  const watcher = startWatcher(ping);

  async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    const { pathname } = url;
    if (req.method === "OPTIONS" && pathname.startsWith("/api/")) {
      send(res, 204, "");
      return true;
    }
    if (req.method === "GET" && pathname === "/api/health") {
      send(
        res,
        200,
        JSON.stringify({
          ok: true,
          service: "ledger",
          ingestSeq,
          days: dayStats(),
          watches: watcher.specs.map((s) => s.label),
        }),
        "application/json; charset=utf-8",
      );
      return true;
    }
    if (req.method === "GET" && pathname === "/api/stream") {
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-store",
        connection: "keep-alive",
        ...CORS,
      });
      res.write(`event: hello\ndata: ${JSON.stringify({ ingestSeq })}\n\n`);
      sse.add(res);
      req.on("close", () => sse.delete(res));
      return true;
    }
    if (req.method === "GET" && pathname.startsWith("/api/summary/")) {
      const day = pathname.slice("/api/summary/".length);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
        send(res, 400, "invalid day");
        return true;
      }
      const file = join(DATA_SUMMARIES, `${day}.md`);
      if (!existsSync(file)) {
        send(res, 404, "no summary");
        return true;
      }
      send(res, 200, readFileSync(file, "utf8"), "text/markdown; charset=utf-8");
      return true;
    }
    if ((req.method === "POST" || req.method === "GET") && pathname === "/api/summarize") {
      let day = url.searchParams.get("day") ?? "";
      if (req.method === "POST") {
        const raw = await readBody(req);
        if (raw.trim()) {
          try {
            const parsed = JSON.parse(raw) as { day?: string };
            if (parsed.day) day = parsed.day;
          } catch {
            send(res, 400, "invalid json");
            return true;
          }
        }
      }
      if (!day) day = dayInPT(new Date());
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
        send(res, 400, "invalid day");
        return true;
      }
      const md = writeDaySummary(day);
      send(res, 200, md, "text/markdown; charset=utf-8");
      return true;
    }
    return false;
  }

  function handler(req: IncomingMessage, res: ServerResponse) {
    void (async () => {
      const host = req.headers.host ?? `127.0.0.1:${wanted}`;
      const url = new URL(req.url ?? "/", `http://${host}`);
      if (await handleApi(req, res, url)) return;
      if (req.method !== "GET" && req.method !== "HEAD") {
        send(res, 405, "method not allowed");
        return;
      }
      const file = resolveStatic(url.pathname);
      if (!file) {
        send(res, 404, "not found");
        return;
      }
      const type = MIME[extname(file).toLowerCase()] ?? "application/octet-stream";
      const buf = readFileSync(file);
      res.writeHead(200, { "content-type": type, "cache-control": "no-store", ...CORS });
      res.end(req.method === "HEAD" ? undefined : buf);
    })().catch((err) => {
      console.error(err);
      if (!res.headersSent) send(res, 500, "internal error");
    });
  }

  const server = createServer(handler);
  const listen = opts?.listen !== false;
  const port = await new Promise<number>((resolvePort, reject) => {
    if (!listen) {
      resolvePort(wanted);
      return;
    }
    const tryListen = (p: number) => {
      const onErr = (err: NodeJS.ErrnoException) => {
        server.off("listening", onListen);
        reject(err);
      };
      const onListen = () => {
        server.off("error", onErr);
        resolvePort(p);
      };
      server.once("error", onErr);
      server.once("listening", onListen);
      server.listen(p, "127.0.0.1");
    };
    tryListen(wanted);
  });

  const origin = `http://127.0.0.1:${port}`;
  if (listen) {
    console.log(`Ledger ${origin} (UI + ingest + /api/summarize)`);
    console.log(`root ${ROOT}`);
    console.log("Local agents only. No cloud scraping.");
  }

  return {
    port,
    origin,
    watcher,
    server,
    summarize: (day?: string) => writeDaySummary(day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : dayInPT(new Date())),
    close: async () => {
      for (const c of sse) c.end();
      sse.clear();
      await new Promise<void>((r) => server.close(() => r()));
      await watcher.close();
    },
  };
}
