import { harvestOnce } from "./harvest.ts";
import { writeFolioLetter } from "./folio-letter.ts";
import { openPreview } from "./notify.ts";
import { markDelivered } from "./paths.ts";

harvestOnce();
const day = process.argv[2];
const out = writeFolioLetter(day);
console.log(`letter ${out.day}`);
if (out.silent) {
  console.log("silent: no topics today");
} else {
  if (out.svgPath) console.log(out.svgPath);
  if (out.pngPath) console.log(out.pngPath);
  if (out.pdfPath) console.log(out.pdfPath);
  else console.log(`pdf skipped (${out.pdfError ?? "write failed"})`);
  if (out.homePng) console.log(out.homePng);
  if (out.homePdf) console.log(out.homePdf);
  console.log(out.opening);
  const preview = out.homePdf || out.pdfPath || out.homePng || out.pngPath;
  if (process.platform === "darwin" && preview) openPreview(preview);
  markDelivered(out.day);
}
