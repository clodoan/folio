import { deflateSync } from "node:zlib";

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcBuf = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcBuf));
  return Buffer.concat([len, crcBuf, crc]);
}

function hexRgb(hex) {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function stamp(px, w, h, cx, cy, r, rgb, a) {
  const x0 = Math.max(0, Math.floor(cx - r - 1));
  const x1 = Math.min(w - 1, Math.ceil(cx + r + 1));
  const y0 = Math.max(0, Math.floor(cy - r - 1));
  const y1 = Math.min(h - 1, Math.ceil(cy + r + 1));
  const r2 = r * r;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (d2 > r2) continue;
      const cover = Math.min(1, (r - Math.sqrt(d2) + 0.5) * a);
      if (cover <= 0) continue;
      const i = (y * w + x) * 4;
      px[i] = px[i] * (1 - cover) + rgb[0] * cover;
      px[i + 1] = px[i + 1] * (1 - cover) + rgb[1] * cover;
      px[i + 2] = px[i + 2] * (1 - cover) + rgb[2] * cover;
    }
  }
}

function strokeStamp(px, W, H, pts, widths, widthMm, sx, sy, hMm, rgb) {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const [x, y] = pts[i];
    const wmm = widths && widths[i] != null ? widths[i] : widthMm;
    const cx = x * sx;
    const cy = (hMm - y) * sy;
    const r = Math.max(0.6, (wmm * sx) / 2);
    stamp(px, W, H, cx, cy, r, rgb, 0.85);
    if (i + 1 < n) {
      const [x2, y2] = pts[i + 1];
      const dx = x2 - x;
      const dy = y2 - y;
      const dist = Math.hypot(dx * sx, dy * sy);
      const steps = Math.max(1, Math.ceil(dist / Math.max(0.7, r * 0.65)));
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        const mx = x + dx * t;
        const my = y + dy * t;
        const w2 = widths && widths[i + 1] != null ? widths[i] * (1 - t) + widths[i + 1] * t : wmm;
        stamp(px, W, H, mx * sx, (hMm - my) * sy, Math.max(0.6, (w2 * sx) / 2), rgb, 0.85);
      }
    }
  }
}


function fillPoly(px, W, H, pts, rgb) {
  const n = pts.length;
  if (n < 3) return;
  let minY = H, maxY = 0, minX = W, maxX = 0;
  for (const p of pts) {
    minY = Math.min(minY, p[1]);
    maxY = Math.max(maxY, p[1]);
    minX = Math.min(minX, p[0]);
    maxX = Math.max(maxX, p[0]);
  }
  minY = Math.max(0, Math.floor(minY));
  maxY = Math.min(H - 1, Math.ceil(maxY));
  minX = Math.max(0, Math.floor(minX));
  maxX = Math.min(W - 1, Math.ceil(maxX));
  for (let y = minY; y <= maxY; y++) {
    const ys = y + 0.5;
    const xs = [];
    for (let i = 0; i < n; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[(i + 1) % n];
      if ((y0 <= ys && y1 > ys) || (y1 <= ys && y0 > ys)) {
        const t = (ys - y0) / (y1 - y0 || 1e-9);
        xs.push(x0 + t * (x1 - x0));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(minX, Math.floor(xs[k]));
      const xb = Math.min(maxX, Math.ceil(xs[k + 1]));
      for (let x = xa; x <= xb; x++) {
        const i = (y * W + x) * 4;
        px[i] = (px[i] * rgb[0]) / 255;
        px[i + 1] = (px[i + 1] * rgb[1]) / 255;
        px[i + 2] = (px[i + 2] * rgb[2]) / 255;
      }
    }
  }
}

export function pageToPng(page, pxW = 1748, pxH = 2480) {
  const { wMm: w, hMm: h, color } = page.paper;
  const sx = pxW / w;
  const sy = pxH / h;
  const px = Buffer.alloc(pxW * pxH * 4);
  const paper = hexRgb(color);
  for (let i = 0; i < px.length; i += 4) {
    px[i] = paper[0];
    px[i + 1] = paper[1];
    px[i + 2] = paper[2];
    px[i + 3] = 255;
  }
  const grain = hexRgb("#6a5e4e");
  for (const g of (page.grain || []).slice(0, 180)) {
    stamp(px, pxW, pxH, g.x * sx, (h - g.y) * sy, Math.max(0.4, g.r * sx), grain, g.a * 3);
  }
  const ink = hexRgb(page.ink);
  const ribbons = page.inkRibbons || [];
  if (ribbons.length) {
    for (const r of ribbons) {
      const pg = (r.polygon || []).map(([x, y]) => [x * sx, (h - y) * sy]);
      fillPoly(px, pxW, pxH, pg, ink);
    }
  } else {
    for (const s of page.inkStrokes || []) {
      if (!s.pts || s.pts.length < 2) continue;
      strokeStamp(px, pxW, pxH, s.pts, s.widths, s.widthMm, sx, sy, h, ink);
    }
  }
  const raw = Buffer.alloc((pxW * 4 + 1) * pxH);
  for (let y = 0; y < pxH; y++) {
    raw[y * (pxW * 4 + 1)] = 0;
    px.copy(raw, y * (pxW * 4 + 1) + 1, y * pxW * 4, (y + 1) * pxW * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(pxW, 0);
  ihdr.writeUInt32BE(pxH, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 6 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return png;
}
