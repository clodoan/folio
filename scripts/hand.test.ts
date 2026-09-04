type Pt = { x: number; y: number };

import assert from "node:assert/strict";
import { test } from "node:test";
import { pickGlyph } from "../folio-hand/src/glyphs.js";
import { HAND, writeWord } from "../folio-hand/src/writer.js";

const pathPts = (ch: string): Pt[] => {
  const g = pickGlyph(ch, 0);
  assert.ok(g, ch);
  return g.path.filter((el: number | Pt): el is Pt => typeof el !== "number");
};

const bowlCloses = (ch: string): boolean => {
  const pts = pathPts(ch);
  const start = pts[0];
  let leftI = 0;
  for (let i = 1; i < pts.length; i++) if (pts[i].x < pts[leftI].x) leftI = i;
  return pts.slice(leftI + 1, -1).some((pt) => Math.hypot(pt.x - start.x, pt.y - start.y) < 0.16);
};

test("hand stays the path cursive, not a font or print", () => {
  assert.equal(HAND.id, "recipes-cursive-v1");
  assert.equal(HAND.letterTrackingCap > 0, true);
  assert.equal(HAND.trackingMinCap >= 0, true);
  const w = writeWord("and", { x: 0, y: 0 }, { pageSeed: 1, i: 1 });
  assert.equal(w.ribbons.length > 0, true);
});

test("n arches high and u sits in a valley", () => {
  const nMid = pathPts("n").filter((p) => p.x > 0.2 && p.x < 0.5);
  const uMid = pathPts("u").filter((p) => p.x > 0.16 && p.x < 0.4);
  const nArch = Math.min(...nMid.map((p) => p.y));
  const uValley = Math.max(...uMid.map((p) => p.y));
  assert.equal(nArch < 0.52, true, `n arch ${nArch}`);
  assert.equal(uValley > 0.98, true, `u valley ${uValley}`);
});

test("a and o close their bowls", () => {
  assert.equal(bowlCloses("a"), true, "a");
  assert.equal(bowlCloses("o"), true, "o");
});

test("letter tracking keeps and from collapsing", () => {
  const andW = writeWord("and", { x: 0, y: 0 }, { pageSeed: 1, i: 1, capMm: HAND.capMm }).widthMm;
  const nW = writeWord("n", { x: 0, y: 0 }, { pageSeed: 1, i: 1, capMm: HAND.capMm }).widthMm;
  assert.equal(andW > nW * 2.5, true, `and ${andW} n ${nW}`);
  const nn = writeWord("nn", { x: 0, y: 0 }, { pageSeed: 1, i: 2, capMm: HAND.capMm }).widthMm;
  assert.equal(nn > nW * 2, true, `nn ${nn} n ${nW}`);
});
