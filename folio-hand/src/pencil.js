/**
 * 2H pencil print-script caps, 0.3mm, #6E6A64.
 * 2H pencil for the date only. Not the felt-tip body.
 * Units: 1em = letter height. y-up, origin left/baseline.
 */

function L(a, b) {
  return [a, b];
}

function pencilArc(cx, cy, rx, ry, a0, a1, n = 14) {
  const strokes = [];
  for (let i = 0; i < n; i++) {
    const t0 = a0 + ((a1 - a0) * i) / n;
    const t1 = a0 + ((a1 - a0) * (i + 1)) / n;
    strokes.push(
      L([cx + rx * Math.cos(t0), cy + ry * Math.sin(t0)], [cx + rx * Math.cos(t1), cy + ry * Math.sin(t1)]),
    );
  }
  return strokes;
}

const H = 1;

export const PENCIL_GLYPHS = {
  " ": { advance: 0.45, strokes: [] },
  "-": { advance: 0.62, strokes: [L([0.08, 0.45], [0.52, 0.45])] },
  0: { advance: 0.78, strokes: pencilArc(0.39, 0.5, 0.22, 0.42, Math.PI * 0.5, Math.PI * 0.5 - Math.PI * 2, 16) },
  1: { advance: 0.5, strokes: [L([0.12, 0.72], [0.28, 0.92]), L([0.28, 0.92], [0.28, 0.08])] },
  2: { advance: 0.72, strokes: [L([0.12, 0.82], [0.18, 0.92]), L([0.18, 0.92], [0.55, 0.92]), L([0.55, 0.92], [0.58, 0.7]), L([0.58, 0.7], [0.14, 0.08]), L([0.14, 0.08], [0.6, 0.08])] },
  3: { advance: 0.72, strokes: [L([0.14, 0.92], [0.56, 0.92]), L([0.56, 0.92], [0.36, 0.55]), L([0.36, 0.55], [0.55, 0.55]), L([0.55, 0.55], [0.58, 0.12]), L([0.58, 0.12], [0.14, 0.08])] },
  4: { advance: 0.72, strokes: [L([0.48, 0.08], [0.48, 0.92]), L([0.48, 0.92], [0.12, 0.38]), L([0.12, 0.38], [0.6, 0.38])] },
  5: { advance: 0.72, strokes: [L([0.55, 0.92], [0.16, 0.92]), L([0.16, 0.92], [0.14, 0.55]), L([0.14, 0.55], [0.5, 0.55]), L([0.5, 0.55], [0.56, 0.12]), L([0.56, 0.12], [0.14, 0.08])] },
  6: { advance: 0.72, strokes: [L([0.52, 0.9], [0.2, 0.9]), L([0.2, 0.9], [0.16, 0.12]), L([0.16, 0.12], [0.54, 0.1]), L([0.54, 0.1], [0.56, 0.48]), L([0.56, 0.48], [0.18, 0.5])] },
  7: { advance: 0.7, strokes: [L([0.12, 0.92], [0.58, 0.92]), L([0.58, 0.92], [0.22, 0.08])] },
  8: { advance: 0.72, strokes: [L([0.2, 0.92], [0.52, 0.92]), L([0.52, 0.92], [0.54, 0.55]), L([0.54, 0.55], [0.18, 0.55]), L([0.18, 0.55], [0.16, 0.92]), L([0.18, 0.55], [0.16, 0.1]), L([0.16, 0.1], [0.54, 0.1]), L([0.54, 0.1], [0.54, 0.55])] },
  9: { advance: 0.72, strokes: [L([0.54, 0.12], [0.54, 0.9]), L([0.54, 0.9], [0.18, 0.9]), L([0.18, 0.9], [0.16, 0.52]), L([0.16, 0.52], [0.54, 0.52])] },
};

function capBox(ch) {
  // Simple architectural print. Height 1, typical width 0.72.
  const s = [];
  const adv = 0.78;
  switch (ch) {
    case "A":
      return { advance: 0.82, strokes: [L([0.08, 0.08], [0.4, 0.92]), L([0.4, 0.92], [0.72, 0.08]), L([0.22, 0.4], [0.58, 0.4])] };
    case "B":
      return { advance: 0.76, strokes: [L([0.16, 0.08], [0.16, 0.92]), L([0.16, 0.92], [0.55, 0.92]), L([0.55, 0.92], [0.58, 0.55]), L([0.58, 0.55], [0.16, 0.5]), L([0.16, 0.5], [0.58, 0.48]), L([0.58, 0.48], [0.6, 0.1]), L([0.6, 0.1], [0.16, 0.08])] };
    case "C":
      return { advance: 0.76, strokes: pencilArc(0.4, 0.5, 0.28, 0.42, Math.PI * 0.4, Math.PI * 0.4 + Math.PI * 1.2, 12) };
    case "D":
      return { advance: 0.8, strokes: [L([0.18, 0.08], [0.18, 0.92]), ...pencilArc(0.36, 0.5, 0.3, 0.42, Math.PI * 0.5, -Math.PI * 0.5, 10), L([0.36, 0.08], [0.18, 0.08])] };
    case "E":
      return { advance: 0.72, strokes: [L([0.16, 0.08], [0.16, 0.92]), L([0.16, 0.92], [0.6, 0.92]), L([0.16, 0.5], [0.5, 0.5]), L([0.16, 0.08], [0.6, 0.08])] };
    case "F":
      return { advance: 0.7, strokes: [L([0.16, 0.08], [0.16, 0.92]), L([0.16, 0.92], [0.6, 0.92]), L([0.16, 0.5], [0.5, 0.5])] };
    case "G":
      return { advance: 0.8, strokes: [...pencilArc(0.4, 0.5, 0.3, 0.42, Math.PI * 0.38, Math.PI * 0.38 + Math.PI * 1.35, 13), L([0.68, 0.42], [0.42, 0.42])] };
    case "H":
      return { advance: 0.8, strokes: [L([0.16, 0.08], [0.16, 0.92]), L([0.62, 0.08], [0.62, 0.92]), L([0.16, 0.5], [0.62, 0.5])] };
    case "I":
      return { advance: 0.42, strokes: [L([0.2, 0.08], [0.2, 0.92]), L([0.08, 0.92], [0.32, 0.92]), L([0.08, 0.08], [0.32, 0.08])] };
    case "J":
      return { advance: 0.68, strokes: [L([0.5, 0.92], [0.5, 0.22]), L([0.5, 0.22], [0.35, 0.08]), L([0.35, 0.08], [0.14, 0.14]), L([0.28, 0.92], [0.58, 0.92])] };
    case "K":
      return { advance: 0.76, strokes: [L([0.16, 0.08], [0.16, 0.92]), L([0.6, 0.92], [0.16, 0.48]), L([0.3, 0.58], [0.62, 0.08])] };
    case "L":
      return { advance: 0.7, strokes: [L([0.16, 0.92], [0.16, 0.08]), L([0.16, 0.08], [0.6, 0.08])] };
    case "M":
      return { advance: 0.92, strokes: [L([0.14, 0.08], [0.14, 0.92]), L([0.14, 0.92], [0.46, 0.4]), L([0.46, 0.4], [0.78, 0.92]), L([0.78, 0.92], [0.78, 0.08])] };
    case "N":
      return { advance: 0.82, strokes: [L([0.16, 0.08], [0.16, 0.92]), L([0.16, 0.92], [0.64, 0.08]), L([0.64, 0.08], [0.64, 0.92])] };
    case "O":
      return { advance: 0.82, strokes: pencilArc(0.41, 0.5, 0.28, 0.42, Math.PI * 0.5, Math.PI * 0.5 - Math.PI * 2, 16) };
    case "P":
      return { advance: 0.74, strokes: [L([0.16, 0.08], [0.16, 0.92]), L([0.16, 0.92], [0.55, 0.92]), L([0.55, 0.92], [0.58, 0.52]), L([0.58, 0.52], [0.16, 0.5])] };
    case "Q":
      return { advance: 0.82, strokes: [...pencilArc(0.41, 0.5, 0.28, 0.42, Math.PI * 0.5, Math.PI * 0.5 - Math.PI * 2, 16), L([0.48, 0.28], [0.7, -0.02])] };
    case "R":
      return { advance: 0.78, strokes: [L([0.16, 0.08], [0.16, 0.92]), L([0.16, 0.92], [0.55, 0.92]), L([0.55, 0.92], [0.58, 0.52]), L([0.58, 0.52], [0.16, 0.5]), L([0.36, 0.5], [0.62, 0.08])] };
    case "S":
      return { advance: 0.72, strokes: [...pencilArc(0.36, 0.72, 0.22, 0.22, Math.PI * 0.15, Math.PI * 1.15, 8), ...pencilArc(0.36, 0.28, 0.22, 0.22, Math.PI * 0.9, -Math.PI * 0.25, 8)] };
    case "T":
      return { advance: 0.74, strokes: [L([0.08, 0.92], [0.66, 0.92]), L([0.37, 0.92], [0.37, 0.08])] };
    case "U":
      return { advance: 0.8, strokes: [L([0.18, 0.92], [0.18, 0.32]), ...pencilArc(0.4, 0.32, 0.22, 0.22, Math.PI, Math.PI * 2, 8), L([0.62, 0.32], [0.62, 0.92])] };
    case "V":
      return { advance: 0.8, strokes: [L([0.1, 0.92], [0.4, 0.08]), L([0.4, 0.08], [0.7, 0.92])] };
    case "W":
      return { advance: 1.02, strokes: [L([0.08, 0.92], [0.28, 0.08]), L([0.28, 0.08], [0.5, 0.7]), L([0.5, 0.7], [0.72, 0.08]), L([0.72, 0.08], [0.92, 0.92])] };
    case "X":
      return { advance: 0.76, strokes: [L([0.12, 0.92], [0.64, 0.08]), L([0.64, 0.92], [0.12, 0.08])] };
    case "Y":
      return { advance: 0.76, strokes: [L([0.1, 0.92], [0.38, 0.48]), L([0.66, 0.92], [0.38, 0.48]), L([0.38, 0.48], [0.38, 0.08])] };
    case "Z":
      return { advance: 0.74, strokes: [L([0.12, 0.92], [0.62, 0.92]), L([0.62, 0.92], [0.12, 0.08]), L([0.12, 0.08], [0.62, 0.08])] };
    default:
      return PENCIL_GLYPHS[ch] || { advance: adv, strokes: s };
  }
}

for (const c of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
  PENCIL_GLYPHS[c] = capBox(c);
}


function lcBox(ch) {
  const xh = 0.68;
  switch (ch) {
    case "a":
      return { advance: 0.62, strokes: [...pencilArc(0.32, 0.34, 0.18, 0.28, Math.PI * 0.2, Math.PI * 0.2 + Math.PI * 1.7, 10), L([0.48, 0.58], [0.48, 0.06])] };
    case "b":
      return { advance: 0.58, strokes: [L([0.16, 0.92], [0.16, 0.08]), ...pencilArc(0.34, 0.34, 0.18, 0.26, Math.PI * 0.85, -Math.PI * 0.85, 10)] };
    case "c":
      return { advance: 0.56, strokes: pencilArc(0.32, 0.34, 0.2, 0.28, Math.PI * 0.35, Math.PI * 0.35 + Math.PI * 1.25, 10) };
    case "e":
      return { advance: 0.56, strokes: [...pencilArc(0.3, 0.34, 0.2, 0.28, 0.15, Math.PI * 1.35, 10), L([0.12, 0.34], [0.48, 0.34])] };
    case "m":
      return { advance: 0.82, strokes: [L([0.1, 0.08], [0.1, 0.62]), L([0.1, 0.5], [0.32, 0.62]), L([0.32, 0.62], [0.32, 0.08]), L([0.32, 0.5], [0.56, 0.62]), L([0.56, 0.62], [0.56, 0.08])] };
    case "p":
      return { advance: 0.58, strokes: [L([0.16, 0.62], [0.16, -0.18]), ...pencilArc(0.34, 0.34, 0.18, 0.26, Math.PI * 0.85, -Math.PI * 0.85, 10)] };
    case "r":
      return { advance: 0.46, strokes: [L([0.12, 0.08], [0.12, 0.62]), L([0.12, 0.5], [0.36, 0.62])] };
    case "s":
      return { advance: 0.5, strokes: [...pencilArc(0.26, 0.48, 0.16, 0.14, Math.PI * 0.15, Math.PI * 1.15, 7), ...pencilArc(0.26, 0.2, 0.16, 0.14, Math.PI * 0.9, -Math.PI * 0.25, 7)] };
    case "t":
      return { advance: 0.42, strokes: [L([0.2, 0.88], [0.2, 0.08]), L([0.06, 0.62], [0.36, 0.62])] };
    case "u":
      return { advance: 0.6, strokes: [L([0.12, 0.62], [0.12, 0.22]), ...pencilArc(0.3, 0.22, 0.18, 0.16, Math.PI, Math.PI * 2, 7), L([0.48, 0.22], [0.48, 0.62])] };
    default:
      return { advance: 0.5, strokes: [L([0.1, 0.08], [0.1, xh])] };
  }
}

for (const c of "abceemprstu") {
  PENCIL_GLYPHS[c] = lcBox(c);
}

export const PENCIL = {
  color: "#6E6A64",
  widthMm: 0.3,
};

export function pencilStrokesForText(text, originX, originY, heightMm) {
  // origin at left, baseline (y-up)
  const out = [];
  let x = 0;
  const tracking = 0.12 * heightMm;
  for (const ch of text) {
    const g = PENCIL_GLYPHS[ch] || PENCIL_GLYPHS[" "];
    for (const [a, b] of g.strokes) {
      out.push({
        a: [originX + x + a[0] * heightMm, originY + a[1] * heightMm],
        b: [originX + x + b[0] * heightMm, originY + b[1] * heightMm],
      });
    }
    x += g.advance * heightMm + tracking;
  }
  return { strokes: out, width: x };
}
