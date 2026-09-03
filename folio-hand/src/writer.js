/**
 * Folio handwriting engine follows Amy Goodchild’s method
 * (Chaikin curve + join tags 0|1|2|3 + shapify ribbons, plus Perlin/value-noise jitter).
 * Glyph coordinates are our own humanist cursive — not her published numeric arrays.
 * Pipeline: pick 2–3 path options → adjust(prev end-tag, next start-tag) → concat
 * (tag 0 lifts the pen) → Chaikin 5× → light noise jitter → shapify (near-constant
 * width, tiny variation, slightly thicker toward baseline, round caps) → fill ink #2A5F9E.
 */

import { pickGlyph, glyphCount } from "./glyphs.js";
import { hashStr, rngFromSeed } from "./seed.js";
import { FELT } from "./nib.js";

export const MOTOR = {
  xHeightMm: 2.90,
  capMm: 6.44,
  tipMm: 0.25,
  slantDeg: 11,
  D_nominal: 1,
  chaikin: 5,
};

export const HAND = {
  id: "recipes-cursive-v1",
  tool: "0.45mm-round-felt",
  slantDeg: MOTOR.slantDeg,
  strokeMm: MOTOR.tipMm,
  capMm: MOTOR.capMm,
  xHeightMm: MOTOR.xHeightMm,
  D_nominal: MOTOR.D_nominal,
  trackingMinCap: -0.02,
  trackingMaxCap: 0.03,
  wordSpaceCap: 0.42,
  leadingCap: 1.55,
  measureMm: 90,
};

function fade(t) {
  return t * t * (3 - 2 * t);
}

function hash2(ix, iy) {
  let n = Math.imul(ix | 0, 374761393) + Math.imul(iy | 0, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** Value noise used as a Perlin stand-in for jitter and stroke width. */
export function valueNoise(x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fade(fx);
  const sy = fade(fy);
  const a = hash2(x0, y0);
  const b = hash2(x0 + 1, y0);
  const c = hash2(x0, y0 + 1);
  const d = hash2(x0 + 1, y0 + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/**
 * Chaikin open curve: copy first/last; for interiors add a point 25% toward
 * the previous and a point 25% toward the next. 5 iterations.
 */
export function chaikin(pts, iterations = 4) {
  let p = pts.map((q) => ({ x: q.x, y: q.y }));
  for (let k = 0; k < iterations; k++) {
    if (p.length < 3) break;
    const n = [{ x: p[0].x, y: p[0].y }];
    for (let i = 1; i < p.length - 1; i++) {
      const prev = p[i - 1];
      const cur = p[i];
      const next = p[i + 1];
      n.push({
        x: cur.x + (prev.x - cur.x) * 0.25,
        y: cur.y + (prev.y - cur.y) * 0.25,
      });
      n.push({
        x: cur.x + (next.x - cur.x) * 0.25,
        y: cur.y + (next.y - cur.y) * 0.25,
      });
    }
    n.push({ x: p[p.length - 1].x, y: p[p.length - 1].y });
    p = n;
  }
  return p;
}

function jitter(pts, amp, ox, oy) {
  return pts.map((p, i) => {
    const n1 = valueNoise(p.x * 3.1 + ox, p.y * 3.1 + oy);
    const n2 = valueNoise(p.x * 3.1 + ox + 19.2, p.y * 3.1 + oy + 7.7);
    const edge = i === 0 || i === pts.length - 1 ? 0.35 : 1;
    return {
      x: p.x + (n1 - 0.5) * 2 * amp * edge,
      y: p.y + (n2 - 0.5) * 2 * amp * edge,
    };
  });
}

function startTag(path) {
  return typeof path[0] === "number" ? path[0] : 0;
}
function endTag(path) {
  const last = path[path.length - 1];
  return typeof last === "number" ? last : 0;
}

function toPoints(path) {
  return path.filter((el) => typeof el !== "number");
}

/**
 * Shapify: at each point, angle to next (last: previous flipped 180°),
 * half-width from noise + thicker toward baseline, offset left/right along
 * the normal, round caps, closed ribbon.
 */
export function shapify(pts, widthAt) {
  const n = pts.length;
  if (n < 2) return [];
  const left = [];
  const right = [];
  const angs = [];
  for (let i = 0; i < n; i++) {
    let ang;
    if (i < n - 1) ang = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x);
    else ang = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x);
    angs.push(ang);
    const w = widthAt(pts[i], i, n);
    const nx = -Math.sin(ang);
    const ny = Math.cos(ang);
    left.push({ x: pts[i].x + nx * w, y: pts[i].y + ny * w });
    right.push({ x: pts[i].x - nx * w, y: pts[i].y - ny * w });
  }
  const cap = (center, from, to, steps) => {
    const a0 = Math.atan2(from.y - center.y, from.x - center.x);
    let a1 = Math.atan2(to.y - center.y, to.x - center.x);
    let d = a1 - a0;
    while (d <= 0) d += Math.PI * 2;
    while (d > Math.PI * 2) d -= Math.PI * 2;
    if (d > Math.PI) d -= Math.PI * 2;
    const out = [];
    const r = Math.hypot(from.x - center.x, from.y - center.y);
    for (let s = 1; s < steps; s++) {
      const a = a0 + (d * s) / steps;
      out.push({ x: center.x + Math.cos(a) * r, y: center.y + Math.sin(a) * r });
    }
    return out;
  };
  const poly = [
    ...left,
    ...cap(pts[n - 1], left[n - 1], right[n - 1], 7),
    ...right.slice().reverse(),
    ...cap(pts[0], right[0], left[0], 7),
  ];
  return poly;
}

function unitToPage(p, origin, capMm, slant) {
  const yu = p.y;
  const y = origin.y + (1 - yu) * capMm;
  const x = origin.x + p.x * capMm + (1 - yu) * slant * capMm;
  return { x, y };
}

function halfWidth(pt, i, n, capMm, ox, oy, originY) {
  const yUnit = 1 - (pt.y - originY) / capMm;
  const towardBase = 1 + 0.04 * Math.max(0, Math.min(1, (yUnit - 0.4) / 0.7));
  const nse = valueNoise(pt.x * 0.55 + ox, pt.y * 0.55 + oy);
  const mid = i / Math.max(1, n - 1);
  const taper = 0.97 + 0.03 * Math.sin(Math.PI * mid);
  return ((MOTOR.tipMm * 0.52) * (0.985 + 0.03 * nse) * towardBase * taper);
}

function assembleWordPaths(letters, choices, rng) {
  const picked = letters.map((ch, i) => {
    if (ch === " ") return null;
    const g = pickGlyph(ch, choices[i]);
    if (!g) return null;
    return g;
  });

  const tags = picked.map((g) => (g ? { s: startTag(g.path), e: endTag(g.path) } : null));
  const adjusted = picked.map((g, i) => {
    if (!g) return null;
    let prev = null;
    let next = null;
    for (let k = i - 1; k >= 0; k--) if (tags[k]) { prev = tags[k]; break; }
    for (let k = i + 1; k < tags.length; k++) if (tags[k]) { next = tags[k]; break; }
    const pc = prev ? prev.e : 0;
    const nc = next ? next.s : 0;
    g.adjust(g.path, pc, nc, g.index, rng);
    return { ...g, pc, nc };
  });

  const subpaths = [];
  let current = [];
  let xOff = 0;
  const glyphMeta = [];

  for (let i = 0; i < letters.length; i++) {
    const g = adjusted[i];
    if (!g) {
      xOff += 0.42;
      continue;
    }
    const x0 = xOff;
    const flush = () => {
      if (current.length >= 2) subpaths.push(current);
      current = [];
    };
    const walk = (path, asMarks) => {
      if (asMarks) flush();
      for (const el of path) {
        if (typeof el === "number") {
          if (el === 0) flush();
        } else {
          current.push({ x: el.x + xOff, y: el.y });
        }
      }
      if (asMarks) flush();
    };
    walk(g.path, false);
    for (const m of g.marks) walk(m, true);
    glyphMeta.push({
      ch: letters[i],
      xUnit: x0,
      advance: g.advance,
      path: toPoints(g.path).map((p) => ({ x: p.x + xOff, y: p.y })),
    });
    xOff += g.advance;
  }
  if (current.length >= 2) subpaths.push(current);
  return { subpaths, glyphMeta, widthUnit: xOff };
}

export function writeWord(word, origin, ctx = {}, trackingEm = 0) {
  const letters = [...String(word)];
  const capMm = (ctx.capMm ?? MOTOR.capMm) * (ctx.D ?? 1) * (1 - (ctx.fatigue || 0) * 0.08);
  const slant = Math.tan(((ctx.slantDeg ?? MOTOR.slantDeg) * Math.PI) / 180);
  const seed = hashStr(
    `${ctx.pageSeed ?? 0}|${word}|${ctx.i ?? 0}|${(ctx.xOnLine ?? 0).toFixed(3)}|${ctx.cluster ?? 0}`,
  );
  const rng = rngFromSeed(seed);
  const choices = letters.map((ch, i) => {
    const n = glyphCount(ch);
    if (!n) return 0;
    return Math.floor(rng() * n);
  });
  const { subpaths, glyphMeta, widthUnit } = assembleWordPaths(letters, choices, rng);

  const ox = (seed % 97) * 0.17;
  const oy = ((seed >>> 8) % 79) * 0.13;
  const ribbons = [];
  const strokes = [];

  for (const sp of subpaths) {
    if (sp.length < 2) continue;
    const curved = chaikin(sp, ctx.chaikin ?? MOTOR.chaikin);
    const jamp = 0.0020 * capMm * (1 + (ctx.fatigue || 0) * 0.55);
    const pagePts = curved.map((p) => unitToPage(p, origin, capMm, slant));
    const jit = jitter(pagePts, jamp, ox, oy);
    const poly = shapify(jit, (pt, i, n) => halfWidth(pt, i, n, capMm, ox, oy, origin.y));
    if (poly.length >= 3) {
      ribbons.push({ polygon: poly.map((q) => [q.x, q.y]) });
    }
    strokes.push({
      points: jit.map((q) => [q.x, q.y]),
      pts: jit.map((q) => [q.x, q.y]),
      widths: jit.map((pt, i) => halfWidth(pt, i, jit.length, capMm, ox, oy, origin.y) * 2),
      widthMm: MOTOR.tipMm,
      lift: true,
    });
  }

  const glyphs = glyphMeta.map((g) => ({
    ch: g.ch,
    x: origin.x + g.xUnit * capMm,
    y: origin.y,
    advanceMm: g.advance * capMm,
    strokes: [
      {
        points: chaikin(g.path, 2).map((p) => {
          const q = unitToPage(p, origin, capMm, slant);
          return [q.x, q.y];
        }),
      },
    ],
  }));

  void trackingEm;
  return {
    ribbons,
    strokes,
    glyphs,
    xEnd: origin.x + widthUnit * capMm,
    widthMm: widthUnit * capMm,
  };
}

export function write(letter, ctx = {}) {
  const origin = { x: 0, y: 0 };
  const w = writeWord(letter, origin, ctx, 0);
  return {
    strokes: w.strokes,
    ribbons: w.ribbons,
    advanceMm: w.widthMm,
    letter,
    glyphs: w.glyphs,
  };
}

export function measureWord(word, ctx = {}) {
  return writeWord(word, { x: 0, y: 0 }, { ...ctx, _measure: true }).widthMm;
}

export { FELT };
