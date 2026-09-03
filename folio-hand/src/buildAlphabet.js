/**
 * Studio Caps v1 — felt-tip architectural print (all caps).
 * Coordinates: cap = 10 units, y-up, origin left/baseline. Unslanted.
 * Every stroke is a written curve (bow, overshoot). Bowls are real ellipses.
 * Frozen into studio-caps-v1.json. Renderer strokes a 0.45mm round felt-tip.
 */

const CAP = 10;

function r(n) {
  return Math.round(n * 1000) / 1000;
}
function P(x, y) {
  return [r(x), r(y)];
}
function cubic(a, b, c, d) {
  return [P(a[0], a[1]), P(b[0], b[1]), P(c[0], c[1]), P(d[0], d[1])];
}

/** Written stroke: always a shallow asymmetric bow, never colinear CAD. */
function written(x0, y0, x1, y1, bow = 0.46) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const b1 = bow * 1.18;
  const b2 = bow * 0.72;
  return cubic(
    [x0, y0],
    [x0 + dx * 0.28 + nx * b1, y0 + dy * 0.28 + ny * b1],
    [x0 + dx * 0.72 + nx * b2, y0 + dy * 0.72 + ny * b2],
    [x1, y1],
  );
}

function stem(x0, y0, x1, y1) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  return written(x0, y0, x1, y1, 0.48 + len * 0.024);
}

function bar(x0, y0, x1, y1) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  return written(x0, y0, x1, y1, 0.24 + len * 0.026);
}

function ellipseCubic(cx, cy, rx, ry, a0, a1) {
  const da = a1 - a0;
  const k = (4 / 3) * Math.tan(da / 4);
  const p0 = [cx + rx * Math.cos(a0), cy + ry * Math.sin(a0)];
  const p3 = [cx + rx * Math.cos(a1), cy + ry * Math.sin(a1)];
  const c1 = [p0[0] - k * rx * Math.sin(a0), p0[1] + k * ry * Math.cos(a0)];
  const c2 = [p3[0] + k * rx * Math.sin(a1), p3[1] - k * ry * Math.cos(a1)];
  return cubic(p0, c1, c2, p3);
}

function arc(cx, cy, rx, ry, a0, a1, segs) {
  const cubics = [];
  const total = a1 - a0;
  const n = segs || Math.max(6, Math.ceil(Math.abs(total) / (Math.PI / 8)));
  for (let i = 0; i < n; i++) {
    cubics.push(ellipseCubic(cx, cy, rx, ry, a0 + (total * i) / n, a0 + (total * (i + 1)) / n));
  }
  return cubics;
}

function G(advance, strokes, marks = []) {
  return { advance: r(advance), strokes, marks };
}

export function buildStudioCapsV1() {
  const glyphs = {};
  const H = CAP;
  const BAR = 5.42;
  const ABAR = 3.82;

  glyphs[" "] = G(3.85, []);

  glyphs.A = G(7.35, [
    [stem(0.38, 0.02, 3.52, 10.18)],
    [stem(3.52, 10.18, 6.95, 0.04)],
    [bar(1.62, ABAR, 5.58, ABAR + 0.08)],
  ]);

  glyphs.B = G(6.65, [
    [stem(0.88, 10.12, 0.98, 0.06)],
    [
      bar(0.88, 10.08, 3.42, 10.12),
      ...arc(3.28, 7.68, 2.26, 2.52, Math.PI * 0.5, -Math.PI * 0.02, 8),
      bar(5.48, 5.22, 0.94, 5.38),
    ],
    [
      bar(0.94, 5.28, 3.55, 5.22),
      ...arc(3.38, 2.58, 2.52, 2.72, Math.PI * 0.48, -Math.PI * 0.03, 8),
      bar(5.82, 0.16, 0.98, 0.08),
    ],
  ]);

  glyphs.C = G(6.9, [
    [...arc(3.48, 5.08, 3.18, 5.22, Math.PI * 0.42, Math.PI * 0.42 + Math.PI * 1.22, 12)],
  ]);

  glyphs.D = G(7.2, [
    [stem(0.92, 10.12, 1.02, 0.05)],
    [
      bar(0.92, 10.08, 3.05, 10.1),
      ...arc(3.08, 5.08, 3.32, 5.22, Math.PI * 0.5, -Math.PI * 0.5, 10),
      bar(3.08, 0.13, 1.02, 0.08),
    ],
  ]);

  glyphs.E = G(6.3, [
    [stem(0.92, 10.14, 1.02, 0.05)],
    [bar(0.92, 10.08, 5.92, 10.14)],
    [bar(0.96, BAR, 5.28, BAR + 0.1)],
    [bar(1.02, 0.1, 5.88, 0.04)],
  ]);

  glyphs.F = G(6.12, [
    [stem(0.92, 10.14, 1.02, 0.05)],
    [bar(0.92, 10.08, 5.72, 10.16)],
    [bar(0.96, BAR, 5.12, BAR + 0.08)],
  ]);

  glyphs.G = G(7.2, [
    [...arc(3.52, 5.08, 3.22, 5.22, Math.PI * 0.38, Math.PI * 0.38 + Math.PI * 1.36, 13)],
    [bar(6.42, 4.62, 3.78, 4.48)],
  ]);

  glyphs.H = G(7.28, [
    [stem(0.92, 10.14, 1.04, 0.05)],
    [stem(6.12, 10.12, 6.24, 0.06)],
    [bar(0.96, BAR, 6.18, BAR + 0.06)],
  ]);

  glyphs.I = G(2.55, [[stem(1.18, 10.16, 1.32, 0.04)]]);

  glyphs.J = G(5.5, [
    [bar(2.05, 10.1, 4.92, 10.16)],
    [
      stem(3.52, 10.12, 3.42, 2.28),
      ...arc(2.05, 2.28, 1.4, 2.15, 0, -Math.PI * 0.88, 6),
    ],
  ]);

  glyphs.K = G(6.82, [
    [stem(0.92, 10.14, 1.02, 0.05)],
    [written(6.02, 10.12, 1.18, 5.12, 0.28)],
    [written(2.38, 6.08, 6.42, 0.04, 0.3)],
  ]);

  glyphs.L = G(6.02, [
    [stem(0.92, 10.14, 1.02, 0.05)],
    [bar(1.02, 0.1, 5.68, 0.04)],
  ]);

  glyphs.M = G(9.2, [
    [
      stem(0.38, 0.04, 0.52, 10.16),
      written(0.52, 10.16, 4.58, 0.08, 0.22),
      written(4.58, 0.08, 8.58, 10.14, 0.22),
      stem(8.58, 10.14, 8.72, 0.04),
    ],
  ]);

  glyphs.N = G(7.42, [
    [
      stem(0.48, 0.04, 0.58, 10.16),
      written(0.58, 10.16, 6.72, 0.06, 0.24),
      stem(6.72, 0.06, 6.82, 10.14),
    ],
  ]);

  glyphs.O = G(7.48, [[...arc(3.72, 5.08, 3.32, 5.28, Math.PI * 0.42, Math.PI * 0.42 - Math.PI * 2, 16)]]);

  glyphs.P = G(6.42, [
    [stem(0.92, 10.14, 1.02, 0.05)],
    [
      bar(0.92, 10.08, 3.48, 10.12),
      ...arc(3.38, 7.62, 2.32, 2.58, Math.PI * 0.5, -Math.PI * 0.04, 8),
      bar(5.62, 5.08, 0.96, 5.18),
    ],
  ]);

  glyphs.Q = G(7.48, [
    [...arc(3.72, 5.08, 3.32, 5.28, Math.PI * 0.42, Math.PI * 0.42 - Math.PI * 2, 16)],
    [written(4.48, 2.22, 6.92, -0.62, 0.22)],
  ]);

  glyphs.R = G(6.85, [
    [stem(0.92, 10.14, 1.02, 0.05)],
    [
      bar(0.92, 10.08, 3.42, 10.12),
      ...arc(3.32, 7.62, 2.26, 2.52, Math.PI * 0.5, -Math.PI * 0.04, 8),
      bar(5.5, 5.12, 0.96, 5.2),
    ],
    [written(3.48, 5.18, 6.52, 0.04, 0.26)],
  ]);

  glyphs.S = G(5.42, [
    [
      ...arc(2.65, 7.58, 2.26, 2.68, Math.PI * 0.12, Math.PI * 1.48, 8),
      ...arc(2.72, 2.38, 2.32, 2.58, Math.PI * 0.52, Math.PI * 0.52 - Math.PI * 1.32, 8),
    ],
  ]);

  glyphs.T = G(6.82, [
    [bar(0.18, 10.1, 6.58, 10.16)],
    [stem(3.32, 10.12, 3.48, 0.04)],
  ]);

  glyphs.U = G(7.28, [
    [
      stem(0.92, 10.14, 0.96, 2.42),
      ...arc(3.62, 2.42, 2.66, 2.66, Math.PI, Math.PI * 2, 8),
      stem(6.28, 2.42, 6.32, 10.12),
    ],
  ]);

  glyphs.V = G(7.22, [
    [stem(0.32, 10.14, 3.52, 0.02)],
    [stem(3.52, 0.02, 6.82, 10.12)],
  ]);

  glyphs.W = G(10.12, [
    [
      written(0.22, 10.12, 2.52, 0.04, 0.22),
      written(2.52, 0.04, 5.02, 7.92, 0.2),
      written(5.02, 7.92, 7.52, 0.04, 0.2),
      written(7.52, 0.04, 9.88, 10.12, 0.22),
    ],
  ]);

  glyphs.X = G(6.82, [
    [written(0.32, 10.12, 6.42, 0.04, 0.28)],
    [written(6.32, 10.12, 0.42, 0.04, 0.28)],
  ]);

  glyphs.Y = G(6.82, [
    [written(0.28, 10.14, 3.38, 4.52, 0.22)],
    [written(6.52, 10.12, 3.38, 4.52, 0.22)],
    [stem(3.38, 4.52, 3.48, 0.04)],
  ]);

  glyphs.Z = G(6.52, [
    [bar(0.32, 10.1, 6.12, 10.16)],
    [written(6.12, 10.16, 0.38, 0.08, 0.24)],
    [bar(0.38, 0.1, 6.18, 0.04)],
  ]);

  glyphs[","] = G(2.05, [
    [cubic([1.02, 0.52], [1.08, -0.12], [0.82, -1.02], [0.32, -1.42])],
  ]);
  glyphs["."] = G(1.95, [], [{ type: "dot", at: [0.92, 0.32] }]);

  return {
    id: "studio-caps-v1",
    tool: "0.45mm-round-felt",
    slantDeg: 1.15,
    strokeMm: 0.45,
    unitMm: 0.435,
    capMm: 4.35,
    capU: CAP,
    trackingMinCap: 0.11,
    trackingMaxCap: 0.13,
    wordSpaceCap: 0.40,
    leadingCap: 2.42,
    measureMm: 90,
    gutterMm: 20,
    glyphs,
  };
}
