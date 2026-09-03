/**
 * Simple ΣΛ: circular-arc geometry through virtual targets (Berio-style).
 * Letters are ballistic strokes to targets, not sampled outlines.
 */

export function circleThrough(a, b, c) {
  const [x1, y1] = a;
  const [x2, y2] = b;
  const [x3, y3] = c;
  const d = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
  if (Math.abs(d) < 1e-10) return null;
  const a2 = x1 * x1 + y1 * y1;
  const b2 = x2 * x2 + y2 * y2;
  const c2 = x3 * x3 + y3 * y3;
  const cx = (a2 * (y2 - y3) + b2 * (y3 - y1) + c2 * (y1 - y2)) / d;
  const cy = (a2 * (x3 - x2) + b2 * (x1 - x3) + c2 * (x2 - x1)) / d;
  const r = Math.hypot(x1 - cx, y1 - cy);
  if (!Number.isFinite(r) || r > 1e6) return null;
  return { cx, cy, r };
}

function ang(p, circ) {
  return Math.atan2(p[1] - circ.cy, p[0] - circ.cx);
}

/** Signed sweep th0→th1 that contains thM. */
export function arcSweep(th0, th1, thM) {
  const ccw = (th1 - th0 + Math.PI * 2) % (Math.PI * 2);
  const ccwM = (thM - th0 + Math.PI * 2) % (Math.PI * 2);
  const cw = (th0 - th1 + Math.PI * 2) % (Math.PI * 2);
  const cwM = (th0 - thM + Math.PI * 2) % (Math.PI * 2);
  const okCCW = ccwM <= ccw + 1e-9;
  const okCW = cwM <= cw + 1e-9;
  if (okCCW && !okCW) return ccw === 0 ? Math.PI * 2 : ccw;
  if (okCW && !okCCW) return -(cw === 0 ? Math.PI * 2 : cw);
  if (okCCW && okCW) return ccw <= cw ? (ccw || Math.PI * 2) : -(cw || Math.PI * 2);
  return Math.abs(ccw) <= Math.PI ? ccw : ccw - Math.PI * 2;
}

function lerpPts(a, c, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t]);
  }
  return pts;
}

export function sampleArc(a, b, c, n = 24, t0 = 0, t1 = 1) {
  const circ = circleThrough(a, b, c);
  const tooWide = circ && circ.r > 4.5;
  if (!circ || tooWide) return lerpPts(a, c, n).map((p, i, arr) => {
    const t = t0 + (t1 - t0) * (i / n);
    return [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t];
  });
  const thA = ang(a, circ);
  const thB = ang(b, circ);
  const thC = ang(c, circ);
  const sweep = arcSweep(thA, thC, thB);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = t0 + (t1 - t0) * (i / n);
    const th = thA + sweep * t;
    pts.push([circ.cx + circ.r * Math.cos(th), circ.cy + circ.r * Math.sin(th)]);
  }
  return pts;
}

function paramOf(a, b, c, p) {
  const circ = circleThrough(a, b, c);
  if (!circ) {
    const dx = c[0] - a[0];
    const dy = c[1] - a[1];
    const den = dx * dx + dy * dy || 1;
    return ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / den;
  }
  const thA = ang(a, circ);
  const thB = ang(b, circ);
  const thC = ang(c, circ);
  const thP = ang(p, circ);
  const sweep = arcSweep(thA, thC, thB);
  if (Math.abs(sweep) < 1e-12) return 0;
  let dt = thP - thA;
  if (sweep >= 0) {
    while (dt < 0) dt += Math.PI * 2;
    while (dt > Math.PI * 2) dt -= Math.PI * 2;
  } else {
    while (dt > 0) dt -= Math.PI * 2;
    while (dt < -Math.PI * 2) dt += Math.PI * 2;
  }
  return dt / sweep;
}

function bowMid(a, b, amount) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  return [a[0] + dx * 0.5 + nx * amount, a[1] + dy * 0.5 + ny * amount];
}

/**
 * Open or closed circular-arc chain through 2–4(+close) targets.
 * Returns a dense polyline in the same units as the targets.
 */
export function sigmaLambda(targets, { closed = false, bow = 0.055, curve = false } = {}) {
  let pts = targets.map((p) => [p[0], p[1]]);
  if (pts.length < 2) return pts;
  const dense = [];
  const pushArc = (a, b, c, tStart, tEnd, samples) => {
    const chunk = sampleArc(a, b, c, samples, tStart, tEnd);
    const start = dense.length ? 1 : 0;
    for (let i = start; i < chunk.length; i++) dense.push(chunk[i]);
  };
  const bowedPair = (a, b) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const mid = bowMid(a, b, bow * len);
    pushArc(a, mid, b, 0, 1, 20);
  };
  const useCurve = curve || closed;
  if (!useCurve) {
    for (let i = 0; i < pts.length - 1; i++) bowedPair(pts[i], pts[i + 1]);
    return dense;
  }
  if (pts.length === 2) {
    const len = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
    pts = [pts[0], bowMid(pts[0], pts[1], bow * len), pts[1]];
  }
  if (closed && pts.length >= 3) {
    const p0 = pts[0];
    const last = pts[pts.length - 1];
    const gap = Math.hypot(last[0] - p0[0], last[1] - p0[1]);
    if (gap > 1e-6) pts = pts.concat([p0]);
  }
  const n = pts.length;
  if (n === 3) {
    pushArc(pts[0], pts[1], pts[2], 0, 1, 48);
    return dense;
  }
  pushArc(pts[0], pts[1], pts[2], 0, 1, 36);
  for (let i = 1; i <= n - 3; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const c = pts[i + 2];
    const tJoin = Math.min(1, Math.max(0, paramOf(a, b, c, pts[i + 1])));
    pushArc(a, b, c, tJoin, 1, 28);
  }
  return dense;
}

function cumLen(pts) {
  const c = [0];
  for (let i = 1; i < pts.length; i++) {
    c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  return c;
}

function atLength(pts, c, s) {
  const total = c[c.length - 1];
  if (total <= 1e-12) return pts[0];
  const target = Math.min(total, Math.max(0, s));
  let i = 1;
  while (i < c.length && c[i] < target) i++;
  const a = pts[i - 1];
  const b = pts[i] || a;
  const span = c[i] - c[i - 1] || 1;
  const t = (target - c[i - 1]) / span;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Raised-cosine speed bell: slow–fast–slow. s(t) = t - sin(2πt)/(2π). */
export function raisedCosineS(t) {
  return t - Math.sin(2 * Math.PI * t) / (2 * Math.PI);
}

/** Log-normal-ish cumulative (truncated). */
export function lognormalS(t, sigma = 0.35) {
  const x = Math.min(1, Math.max(1e-4, t));
  const z = Math.log(x) / (sigma * Math.SQRT2);
  // approximate Φ via erf
  const erf = (v) => {
    const s = v < 0 ? -1 : 1;
    const a = Math.abs(v);
    const p = 0.3275911;
    const k = 1 / (1 + p * a);
    const e =
      1 -
      ((((1.061405429 * k - 1.453152027) * k + 1.421413741) * k - 0.284496736) * k + 0.254829592) *
        k *
        Math.exp(-a * a);
    return s * e;
  };
  const cdf = 0.5 * (1 + erf(z));
  const c0 = 0.5 * (1 + erf(Math.log(1e-4) / (sigma * Math.SQRT2)));
  const c1 = 0.5 * (1 + erf(0));
  return (cdf - c0) / (c1 - c0 || 1);
}

export function resampleBell(pts, n = 60, profile = "raised-cosine") {
  if (pts.length < 2) return pts.slice();
  const c = cumLen(pts);
  const total = c[c.length - 1];
  const out = [];
  const sfn = profile === "lognormal" ? lognormalS : raisedCosineS;
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    out.push(atLength(pts, c, sfn(t) * total));
  }
  return out;
}
