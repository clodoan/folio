/** Seed = hash(ISO date + "recipes-cursive-v1"). One seed per page. */

export const HAND_ID = "recipes-cursive-v1";

export function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pageSeed(isoDate) {
  return hashStr(`${isoDate}${HAND_ID}`);
}

export function mulberry32(a) {
  let t = a >>> 0;
  return function rng() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngFromSeed(seed) {
  return mulberry32(seed);
}
