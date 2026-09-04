import { pageSeed, rngFromSeed } from "./seed.js";
import { FELT } from "./nib.js";
import { writeWord, HAND } from "./writer.js";

export const PAPER = {
  wMm: 148,
  hMm: 210,
  color: FELT.paper,
  ink: FELT.ink,
};

export const SAMPLE_LETTER = {
  day: "2026-09-02",
  dateLabel: "2 September",
  name: "Ada",
  opening: "Today we worked with Ada on the journal, the letter, and the evening page.",
  stanza: "The page holds the hour.",
  stanzas: [
    "the journal took the morning,",
    "and gave it back in order.",
    "the letter waited for dusk,",
    "then said what the day had said.",
    "the evening page held the hour,",
    "and the ink dried in the margin.",
  ],
  close: "We set the work down.",
  initials: "Aa",
};

function keepHand(text) {
  return String(text || "")
    .replace(/[^A-Za-z0-9.,' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function humanDate(isoDate) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate || ""));
  if (!m) return String(isoDate || "");
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${String(Number(m[3]))} ${months[Number(m[2]) - 1] || m[2]}`;
}

/** @param {any} letter */
export function composePage(letter = SAMPLE_LETTER, isoDate = letter.day) {
  const seed = pageSeed(isoDate);
  const rng = rngFromSeed(seed);
  const cap = HAND.capMm;
  const measure = HAND.measureMm;

  const inkStrokes = [];
  const inkRibbons = [];
  const glyphs = [];
  let serial = 1;

  function wordWidth(word, ctxCap) {
    return writeWord(word, { x: 0, y: 0 }, {
      pageSeed: seed,
      i: 8000 + serial,
      fatigue: 0,
      capMm: ctxCap,
      D: 1,
      cluster: 9,
    }).widthMm;
  }

  function wrapLine(text, ctxCap, maxW) {
    const words = keepHand(text).split(/\s+/).filter(Boolean);
    const space = HAND.wordSpaceCap * ctxCap;
    const lines = [];
    let cur = [];
    let w = 0;
    for (const word of words) {
      const ww = wordWidth(word, ctxCap);
      const extra = cur.length ? space : 0;
      if (cur.length && w + extra + ww > maxW) {
        lines.push(cur);
        cur = [word];
        w = ww;
      } else {
        w += extra + ww;
        cur.push(word);
      }
    }
    if (cur.length) lines.push(cur);
    return lines;
  }

  function placeTextBlock(text, x0, y0, { fatigue, indent = 0, D = 1, cluster = 0, capMm = cap, measureMm = measure }) {
    const blockSpace = HAND.wordSpaceCap * capMm;
    const blockLead = HAND.leadingCap * capMm;
    const lines = wrapLine(text, capMm, measureMm);
    let y = y0;
    let xCursor = x0;
    for (const words of lines) {
      const lineNudge = (rng() * 2 - 1) * (0.55 + fatigue * 1.4);
      let x = x0 + indent + lineNudge;
      const slope = -Math.abs(rng() * (0.008 + fatigue * 0.014)) - fatigue * 0.004;
      const amp = 0.22 + rng() * 0.28 + fatigue * 0.28;
      const phase = rng() * Math.PI * 2;
      const lineX0 = x;
      for (let wi = 0; wi < words.length; wi++) {
        const word = words[wi];
        const t = (x - lineX0) / Math.max(8, measureMm);
        const wander = slope * (x - lineX0) + amp * Math.sin(t * Math.PI * 1.1 + phase);
        const yb = y + wander + (rng() * 2 - 1) * 0.16 * (1 + fatigue);
        const placed = writeWord(
          word,
          { x, y: yb },
          {
            pageSeed: seed,
            i: serial,
            fatigue,
            capMm,
            D,
            slantDeg: HAND.slantDeg + (rng() * 2 - 1) * 1.4,
            xOnLine: (x - x0) / measureMm,
            cluster,
          },
        );
        serial += word.length + 1;
        inkStrokes.push(...placed.strokes);
        inkRibbons.push(...placed.ribbons);
        glyphs.push(...placed.glyphs);
        x = placed.xEnd + blockSpace * (1 + (rng() * 2 - 1) * (0.08 + fatigue * 0.14));
        xCursor = x;
      }
      y -= blockLead * (1 + (rng() * 2 - 1) * 0.04) * (1 + fatigue * 0.04);
    }
    return { y, xEnd: xCursor, lineCount: lines.length };
  }

  const name = keepHand(letter.name);
  const initials = String(letter.initials || "Aa").replace(/ /g, "").slice(0, 2);
  let opening = keepHand(letter.opening);
  if (name && initials && name.length > 2) {
    const leaked = new RegExp(`\\bwith\\s+${initials}\\b`);
    if (leaked.test(opening)) opening = opening.replace(leaked, `with ${name}`);
  }
  const stanzaList = (Array.isArray(letter.stanzas) ? letter.stanzas : [letter.stanza || ""])
    .map((s) => keepHand(s))
    .filter(Boolean);
  const close = keepHand(letter.close);

  const dateCap = cap * 0.85;
  const dateStr = letter.dateLabel || humanDate(isoDate);
  const dateWords = String(dateStr).split(/\s+/).filter(Boolean);
  const dateSpace = HAND.wordSpaceCap * dateCap;
  let dateW = 0;
  for (let i = 0; i < dateWords.length; i++) {
    if (i) dateW += dateSpace;
    dateW += wordWidth(dateWords[i], dateCap);
  }
  let dateX = PAPER.wMm - 16 - dateW;
  const dateY = PAPER.hMm - 16;
  for (const word of dateWords) {
    const placed = writeWord(word, { x: dateX, y: dateY }, {
      pageSeed: seed,
      i: serial,
      fatigue: 0.03,
      capMm: dateCap,
      D: 1,
      slantDeg: HAND.slantDeg + (rng() * 2 - 1) * 0.8,
      cluster: 8,
    });
    serial += word.length + 1;
    inkStrokes.push(...placed.strokes);
    inkRibbons.push(...placed.ribbons);
    glyphs.push(...placed.glyphs);
    dateX = placed.xEnd + dateSpace;
  }

  const left = 22;
  const openY = PAPER.hMm - 52;
  const bottomMm = 24;
  const bodyMeasure = PAPER.wMm - left - 22;

  // A longer poem still writes one A5 page: measure every block, then
  // scale the body hand down just enough to fit above the signature.
  const openGap = 0.6;
  const stanzaGap = 0.15;
  const closeGap = 0.7;
  const sigRoom = 2.1;
  const neededMm = (f) => {
    const c = cap * f;
    const lead = HAND.leadingCap * c;
    let leads = wrapLine(opening, c, bodyMeasure).length + openGap;
    for (const s of stanzaList) leads += wrapLine(s, c, bodyMeasure).length;
    leads += stanzaGap * Math.max(0, stanzaList.length - 1);
    leads += closeGap + wrapLine(close, c, bodyMeasure).length + sigRoom;
    return leads * lead;
  };
  let fit = 1;
  const budgetMm = openY - bottomMm;
  while (fit > 0.62 && neededMm(fit) > budgetMm) fit -= 0.02;
  const bodyCap = cap * fit;
  const bodyLead = HAND.leadingCap * bodyCap;

  const rOpen = placeTextBlock(opening, left, openY, {
    fatigue: 0.06,
    cluster: 0,
    capMm: bodyCap,
    measureMm: bodyMeasure,
  });

  let y = rOpen.y - bodyLead * openGap;
  for (let si = 0; si < stanzaList.length; si++) {
    const rStanza = placeTextBlock(stanzaList[si], left, y, {
      fatigue: 0.22 + si * 0.03,
      indent: 5,
      cluster: 1 + si,
      capMm: bodyCap,
      measureMm: bodyMeasure,
    });
    y = rStanza.y - (si + 1 < stanzaList.length ? bodyLead * stanzaGap : 0);
  }

  const rClose = placeTextBlock(close, left, y - bodyLead * closeGap, {
    fatigue: 0.48,
    indent: 24,
    cluster: 2,
    capMm: bodyCap,
    measureMm: bodyMeasure,
  });

  const sigX = 78 + (rng() * 2 - 1) * 7;
  const sigY = Math.max(10, rClose.y - bodyLead * 1.05 + (rng() * 2 - 1) * 2.2);
  const sig = writeWord(initials, { x: sigX, y: sigY }, {
    pageSeed: seed,
    i: serial,
    fatigue: 0.12,
    capMm: Math.max(cap * 1.28 * fit, cap * 0.95),
    D: 1,
    slantDeg: HAND.slantDeg + 2.2,
    cluster: 3,
    signature: true,
  });
  inkStrokes.push(...sig.strokes);
  inkRibbons.push(...sig.ribbons);
  glyphs.push(...sig.glyphs.map((g) => ({ ...g, signature: true })));

  const grain = [];
  const grng = rngFromSeed(seed ^ 0x9e3779b9);
  for (let i = 0; i < 720; i++) {
    grain.push({
      x: grng() * PAPER.wMm,
      y: grng() * PAPER.hMm,
      r: 0.012 + grng() * 0.028,
      a: 0.01 + grng() * 0.02,
    });
  }

  return {
    seed,
    isoDate,
    paper: PAPER,
    inkStrokes: inkStrokes.map((s) => ({
      pts: s.points || s.pts,
      widths: s.widths,
      widthMm: s.widthMm,
      lift: s.lift,
    })),
    inkRibbons,
    grain,
    ink: PAPER.ink,
    nLines: wrapLine(opening, cap, measure).length,
    glyphs,
    scale: 1,
    handId: HAND.id,
  };
}

export function eProof(page) {
  const es = (page.glyphs || []).filter((g) => g.ch === "e" && !g.signature);
  const a = es[0];
  const b = es[1];
  if (!a || !b) return { count: es.length, rms: 0, note: "need two e glyphs" };
  function pack(g) {
    const pts = [];
    for (const s of g.strokes || []) {
      for (const p of s.points || s.pts || []) pts.push(p);
    }
    return pts;
  }
  const pa = pack(a);
  const pb = pack(b);
  const n = Math.min(pa.length, pb.length);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const dx = pa[i][0] - a.x - (pb[i][0] - b.x);
    const dy = pa[i][1] - a.y - (pb[i][1] - b.y);
    acc += dx * dx + dy * dy;
  }
  const rms = Math.sqrt(acc / Math.max(1, n));
  return { count: es.length, rms, n, ax: a.x, bx: b.x };
}
