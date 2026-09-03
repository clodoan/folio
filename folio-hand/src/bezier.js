export function cubicPoint(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const uu = u * u;
  const tt = t * t;
  const x = uu * u * p0[0] + 3 * uu * t * p1[0] + 3 * u * tt * p2[0] + tt * t * p3[0];
  const y = uu * u * p0[1] + 3 * uu * t * p1[1] + 3 * u * tt * p2[1] + tt * t * p3[1];
  return [x, y];
}

export function cubicTangent(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const x = 3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]);
  const y = 3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]);
  return [x, y];
}

function dist(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.hypot(dx, dy);
}

/** Sample a cubic polyline (sequence of cubics sharing ends) at ~step units. */
export function sampleCubics(cubics, step = 0.12) {
  const pts = [];
  const tans = [];
  for (const c of cubics) {
    const [p0, p1, p2, p3] = c;
    const approx = dist(p0, p1) + dist(p1, p2) + dist(p2, p3);
    const n = Math.max(4, Math.ceil(approx / step));
    const start = pts.length === 0 ? 0 : 1;
    for (let i = start; i <= n; i++) {
      const t = i / n;
      pts.push(cubicPoint(p0, p1, p2, p3, t));
      tans.push(cubicTangent(p0, p1, p2, p3, t));
    }
  }
  return { pts, tans };
}
