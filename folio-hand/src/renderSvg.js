function poly(pts) {
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(3)} ${p[1].toFixed(3)}`).join(" ") + " Z";
}

function polyOpen(pts) {
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(3)} ${p[1].toFixed(3)}`).join(" ");
}

function yflip(p, h) {
  return [p[0], h - p[1]];
}

export function pageToSvg(page) {
  const { wMm: w, hMm: h, color } = page.paper;
  const parts = [];
  parts.push(`<rect width="${w}" height="${h}" fill="${color}"/>`);
  for (const ln of page.laid || []) {
    const y = (h - ln.y).toFixed(3);
    parts.push(`<path d="M0 ${y} H${w}" stroke="#c9bfae" stroke-width="0.12" opacity="${ln.a}"/>`);
  }
  for (const g of (page.grain || []).slice(0, 180)) {
    const [x, y] = yflip([g.x, g.y], h);
    parts.push(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${g.r.toFixed(3)}" fill="#6a5e4e" opacity="${g.a.toFixed(3)}"/>`);
  }

  const ink = page.ink;
  parts.push('<g style="mix-blend-mode:multiply">');
  const ribbons = page.inkRibbons || [];
  if (!ribbons.length) for (const s of page.inkStrokes || []) {
    if (!s.pts || s.pts.length < 2) continue;
    const flipped = s.pts.map((pt) => yflip(pt, h));
    const widths = s.widths;
    if (widths && widths.length === s.pts.length) {
      const k = 6;
      const n = flipped.length;
      for (let c = 0; c < k; c++) {
        const i0 = Math.floor((c * (n - 1)) / k);
        const i1 = Math.max(i0 + 1, Math.floor(((c + 1) * (n - 1)) / k));
        const slice = flipped.slice(i0, i1 + 1);
        if (slice.length < 2) continue;
        let w = 0;
        let cnt = 0;
        for (let i = i0; i <= Math.min(i1, widths.length - 1); i++) {
          w += widths[i];
          cnt++;
        }
        const d = polyOpen(slice);
        parts.push(
          `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${(w / cnt).toFixed(3)}" stroke-linecap="round" stroke-linejoin="round"/>`,
        );
      }
    } else {
      const d = polyOpen(flipped);
      parts.push(
        `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${s.widthMm}" stroke-linecap="round" stroke-linejoin="round"/>`,
      );
    }
  }
  for (const d of page.dots || []) {
    const [x, y] = yflip([d.x, d.y], h);
    parts.push(`<circle cx="${x.toFixed(3)}" cy="${y.toFixed(3)}" r="${d.r.toFixed(3)}" fill="${ink}"/>`);
  }
  for (const r of page.inkRibbons || []) {
    const pg = r.polygon.map((p) => yflip(p, h));
    parts.push(`<path d="${poly(pg)}" fill="${ink}"/>`);
  }
  for (const s of page.stamps || []) {
    const pg = s.map((p) => yflip(p, h));
    parts.push(`<path d="${poly(pg)}" fill="${ink}"/>`);
  }
  parts.push("</g>");
  for (const s of page.pencil || []) {
    const a = yflip(s.a, h);
    const b = yflip(s.b, h);
    parts.push(
      `<path d="M${a[0].toFixed(3)} ${a[1].toFixed(3)} L${b[0].toFixed(3)} ${b[1].toFixed(3)}" stroke="${page.pencilColor}" stroke-width="${page.pencilWidth}" stroke-linecap="round" fill="none"/>`,
    );
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">
${parts.join("\n")}
</svg>`;
}
