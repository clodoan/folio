declare module "../folio-hand/src/page.js" {
  export const PAPER: { wMm: number; hMm: number; color: string; ink: string };
  export const SAMPLE_LETTER: {
    day: string;
    dateLabel: string;
    name: string;
    opening: string;
    stanza: string;
    stanzas: string[];
    close: string;
    initials: string;
  };
  export function humanDate(isoDate: string): string;
  export function composePage(
    letter?: {
      day?: string;
      dateLabel?: string;
      name?: string;
      opening: string;
      stanza?: string;
      stanzas?: string[];
      close: string;
      initials?: string;
    },
    isoDate?: string,
  ): {
    seed: number;
    isoDate: string;
    paper: typeof PAPER;
    ink: string;
    inkRibbons: { polygon: [number, number][] }[];
    inkStrokes: unknown[];
    [key: string]: unknown;
  };
}

declare module "../folio-hand/src/renderSvg.js" {
  export function pageToSvg(page: unknown): string;
}

declare module "../folio-hand/src/renderPdf.js" {
  export function pageToPdf(page: unknown): string;
}

declare module "../folio-hand/src/renderPng.js" {
  export function pageToPng(page: unknown, pxW?: number, pxH?: number): Uint8Array;
}

declare module "../folio-hand/src/glyphs.js" {
  export function pickGlyph(
    letter: string,
    n: number,
  ): {
    path: Array<number | { x: number; y: number }>;
    advance: number;
    index: number;
  } | null;
}

declare module "../folio-hand/src/writer.js" {
  export const HAND: {
    id: string;
    capMm: number;
    letterTrackingCap: number;
    trackingMinCap: number;
    wordSpaceCap: number;
    leadingCap: number;
    ascenderGain: number;
    descenderGain: number;
  };
  export function writeWord(
    word: string,
    origin: { x: number; y: number },
    ctx?: Record<string, unknown>,
    trackingEm?: number,
  ): { widthMm: number; ribbons: { polygon: [number, number][] }[] };
}
