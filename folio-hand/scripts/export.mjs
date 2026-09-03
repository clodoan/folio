import { mkdirSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { freezeGlyphs } from "../src/glyphs.js";
import { composePage, SAMPLE_LETTER, PAPER, eProof } from "../src/page.js";
import { pageToSvg } from "../src/renderSvg.js";
import { pageToPdf } from "../src/renderPdf.js";
import { pageToPng } from "../src/renderPng.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "out");
mkdirSync(outDir, { recursive: true });

for (const dead of ["studio-italic-v1.json", "studio-caps-v1.json", "recipes-caps-v1.json"]) {
  const fp = join(root, dead);
  if (existsSync(fp)) unlinkSync(fp);
}

const recipes = freezeGlyphs();
const hand = { id: recipes.id, tool: "0.45mm-round-felt" };
if (hand.id !== "recipes-cursive-v1") {
  throw new Error(`export refused: hand id is ${hand.id}, not recipes-cursive-v1`);
}
if (hand.tool !== "0.45mm-round-felt") {
  throw new Error(`export refused: tool is ${hand.tool}, not round felt`);
}
writeFileSync(join(root, "recipes-cursive-v1.json"), JSON.stringify(recipes, null, 2));

const page = composePage(null, SAMPLE_LETTER, SAMPLE_LETTER.day);
const proof = eProof(page);
console.log("e-proof", JSON.stringify(proof));
if (!(proof.rms > 0.08)) throw new Error("two e glyphs must differ: " + JSON.stringify(proof));
if (page.ink !== "#2A5F9E") throw new Error("ink must be #2A5F9E");
if (!(page.inkRibbons || []).length) throw new Error("shapify ribbons required");
const svg = pageToSvg(page);
const pdf = pageToPdf(page);
writeFileSync(join(outDir, "sample.svg"), svg);
writeFileSync(join(outDir, "sample.pdf"), pdf);

const html = `<!doctype html>
<html><head><meta charset="utf-8"/>
<style>
  html, body { margin:0; padding:0; width:1748px; height:2480px; overflow:hidden; background:${PAPER.color}; }
  svg { display:block; width:1748px; height:2480px; }
</style></head>
<body>${svg.replace(/^<\\?xml[^>]*>\\s*/, "")}</body></html>`;
const htmlPath = join(outDir, "sample.html");
writeFileSync(htmlPath, html);

const pngPath = join(outDir, "sample.png");
writeFileSync(pngPath, pageToPng(page, 1748, 2480));

console.log("id", hand.id);
console.log("seed", page.seed);
console.log("scale", page.scale.toFixed(4));
console.log("ink", page.ink);
console.log("ribbons", (page.inkRibbons || []).length);
console.log("engine", "goodchild-chaikin-shapify");
console.log(join(outDir, "sample.svg"));
console.log(join(outDir, "sample.pdf"));
if (existsSync(pngPath)) console.log(pngPath);
