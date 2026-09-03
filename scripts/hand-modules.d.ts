declare module "../folio-hand/src/page.js" {
  export const PAPER: { wMm: number; hMm: number; color: string; ink: string };
  export const SAMPLE_LETTER: {
    day: string;
    dateLabel: string;
    name: string;
    opening: string;
    stanza: string;
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
