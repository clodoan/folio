import { composePage, SAMPLE_LETTER } from "./page.js";
import { drawPage } from "./renderCanvas.js";
import { HAND } from "./writer.js";

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const dayEl = document.getElementById("day");
const meta = document.getElementById("meta");

function render() {
  const day = dayEl.value || SAMPLE_LETTER.day;
  const page = composePage(null, { ...SAMPLE_LETTER, day }, day);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawPage(ctx, page, canvas.width, canvas.height);
  meta.textContent = `seed ${page.seed}  ${HAND.id}  shapify  cap ${HAND.capMm}mm`;
}

dayEl.addEventListener("change", render);
render();
