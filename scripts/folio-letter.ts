import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { composePage, humanDate, PAPER } from "../folio-hand/src/page.js";
import { pageToPdf } from "../folio-hand/src/renderPdf.js";
import { pageToPng } from "../folio-hand/src/renderPng.js";
import { pageToSvg } from "../folio-hand/src/renderSvg.js";
import { composeLetter, stanzaLines } from "../src/letter.ts";
import { dayInPT, parseDayJsonl } from "../src/schema.ts";
import { loadFolioConfig } from "./folio-config.ts";
import { DATA_DAYS, LETTERS_DIR } from "./paths.ts";

export type LetterWrite = {
  day: string;
  htmlPath: string;
  pdfPath: string | null;
  pngPath: string | null;
  svgPath: string | null;
  homeHtml: string | null;
  homePdf: string | null;
  homePng: string | null;
  homeSvg: string | null;
  opening: string;
  silent: boolean;
  pdfOk: boolean;
  pdfError?: string;
};

export function documentsLettersDir(): string | null {
  try {
    const h = homedir();
    if (!h || h === "/") return null;
    return join(h, "Documents", "Folio", "letters");
  } catch {
    return null;
  }
}

function readDay(day: string) {
  const path = join(DATA_DAYS, `${day}.jsonl`);
  if (!existsSync(path)) return [];
  return parseDayJsonl(readFileSync(path, "utf8"));
}

function copyTo(src: string, dest: string): void {
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
}

function svgViewerHtml(svg: string, day: string): string {
  const body = svg.replace(/^<\?xml[^>]*>\s*/u, "");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<title>${day}</title>
<style>
  html, body { margin:0; padding:0; background:${PAPER.color}; }
  svg { display:block; width:148mm; height:210mm; }
</style></head>
<body>${body}</body></html>
`;
}

export function writeFolioLetter(dayArg?: string): LetterWrite {
  const cfg = loadFolioConfig();
  const day = dayArg && /^\d{4}-\d{2}-\d{2}$/.test(dayArg) ? dayArg : dayInPT(new Date());
  const events = readDay(day);
  const letter = composeLetter(day, events, { name: cfg.name, timezone: cfg.timezone });

  const empty: LetterWrite = {
    day,
    htmlPath: join(LETTERS_DIR, `${day}.html`),
    pdfPath: null,
    pngPath: null,
    svgPath: null,
    homeHtml: null,
    homePdf: null,
    homePng: null,
    homeSvg: null,
    opening: letter.opening,
    silent: letter.silent,
    pdfOk: false,
  };

  if (letter.silent) {
    return empty;
  }

  const page = composePage(
    null,
    {
      day,
      dateLabel: humanDate(day),
      name: letter.name,
      opening: letter.opening,
      stanza: stanzaLines(letter)[0] || "",
      stanzas: stanzaLines(letter),
      close: letter.close,
      initials: letter.initials,
    },
    day,
  );

  mkdirSync(LETTERS_DIR, { recursive: true });
  const svgPath = join(LETTERS_DIR, `${day}.svg`);
  const pdfPath = join(LETTERS_DIR, `${day}.pdf`);
  const pngPath = join(LETTERS_DIR, `${day}.png`);
  const htmlPath = join(LETTERS_DIR, `${day}.html`);

  const svg = pageToSvg(page);
  const pdf = pageToPdf(page);
  const png = pageToPng(page, 1748, 2480);
  writeFileSync(svgPath, svg);
  writeFileSync(pdfPath, pdf);
  writeFileSync(pngPath, png);
  writeFileSync(htmlPath, svgViewerHtml(svg, day), "utf8");

  const pdfWritten = existsSync(pdfPath) ? pdfPath : null;
  const pngWritten = existsSync(pngPath) ? pngPath : null;

  let homeHtml: string | null = null;
  let homePdf: string | null = null;
  let homePng: string | null = null;
  let homeSvg: string | null = null;
  const homeDir = documentsLettersDir();
  if (homeDir) {
    try {
      mkdirSync(homeDir, { recursive: true });
      homeHtml = join(homeDir, `${day}.html`);
      homeSvg = join(homeDir, `${day}.svg`);
      copyTo(htmlPath, homeHtml);
      copyTo(svgPath, homeSvg);
      if (pdfWritten) {
        homePdf = join(homeDir, `${day}.pdf`);
        copyTo(pdfWritten, homePdf);
      }
      if (pngWritten) {
        homePng = join(homeDir, `${day}.png`);
        copyTo(pngWritten, homePng);
      }
    } catch {
      homeHtml = null;
      homePdf = null;
      homePng = null;
      homeSvg = null;
    }
  }

  return {
    day,
    htmlPath,
    pdfPath: pdfWritten,
    pngPath: pngWritten,
    svgPath,
    homeHtml,
    homePdf,
    homePng,
    homeSvg,
    opening: letter.opening,
    silent: false,
    pdfOk: Boolean(pdfWritten),
    pdfError: pdfWritten ? undefined : "hand pdf write failed",
  };
}

const invoked = process.argv[1]?.includes("folio-letter");
if (invoked) {
  const arg = process.argv[2];
  const out = writeFolioLetter(arg);
  if (out.silent) {
    console.log(`letter ${out.day} silent: no topics`);
  } else {
    console.log(`letter ${out.day} svg=${out.svgPath}`);
    if (out.pngPath) console.log(`png ${out.pngPath}`);
    if (out.pdfPath) console.log(`pdf ${out.pdfPath}`);
    else console.log(`pdf skipped (${out.pdfError ?? "write failed"})`);
    if (out.homePdf || out.homePng) console.log(`home ${out.homePdf || out.homePng}`);
    console.log(out.opening);
  }
}
