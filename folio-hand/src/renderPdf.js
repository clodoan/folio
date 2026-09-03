function mm(n) {
  return n * (72 / 25.4);
}

function rgb(hex) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return `${r.toFixed(4)} ${g.toFixed(4)} ${b.toFixed(4)}`;
}

function strokePath(pts) {
  if (!pts.length) return "";
  const bits = [`${mm(pts[0][0]).toFixed(3)} ${mm(pts[0][1]).toFixed(3)} m`];
  for (let i = 1; i < pts.length; i++) {
    bits.push(`${mm(pts[i][0]).toFixed(3)} ${mm(pts[i][1]).toFixed(3)} l`);
  }
  bits.push("S");
  return bits.join(" ");
}

export function pageToPdf(page) {
  const W = mm(page.paper.wMm);
  const H = mm(page.paper.hMm);
  const ops = [];
  ops.push("q");
  ops.push(`${rgb(page.paper.color)} rg`);
  ops.push(`0 0 ${W.toFixed(3)} ${H.toFixed(3)} re f`);

  ops.push(`${rgb("#6a5e4e")} rg`);
  for (const g of page.grain || []) {
    ops.push(`q ${g.a.toFixed(3)} g`);
    const x = mm(g.x - g.r);
    const y = mm(g.y - g.r);
    const s = mm(g.r * 2);
    ops.push(`${x.toFixed(2)} ${y.toFixed(2)} ${s.toFixed(2)} ${s.toFixed(2)} re f Q`);
  }

  ops.push("/Ink gs");
  ops.push(`${rgb(page.ink)} rg`);
  const ribbons = page.inkRibbons || [];
  if (ribbons.length) {
    for (const r of ribbons) {
      const pg = r.polygon || [];
      if (pg.length < 3) continue;
      const bits = [`${mm(pg[0][0]).toFixed(3)} ${mm(pg[0][1]).toFixed(3)} m`];
      for (let i = 1; i < pg.length; i++) {
        bits.push(`${mm(pg[i][0]).toFixed(3)} ${mm(pg[i][1]).toFixed(3)} l`);
      }
      bits.push("h f");
      ops.push(bits.join(" "));
    }
  }
  ops.push(`${rgb(page.ink)} RG`);
  ops.push("1 J 1 j");
  if (!ribbons.length) for (const s of page.inkStrokes || []) {
    if (!s.pts || s.pts.length < 2) continue;
    const widths = s.widths;
    if (widths && widths.length === s.pts.length) {
      const k = 6;
      const n = s.pts.length;
      for (let c = 0; c < k; c++) {
        const i0 = Math.floor((c * (n - 1)) / k);
        const i1 = Math.max(i0 + 1, Math.floor(((c + 1) * (n - 1)) / k));
        const slice = s.pts.slice(i0, i1 + 1);
        if (slice.length < 2) continue;
        let w = 0;
        let cnt = 0;
        for (let i = i0; i <= Math.min(i1, widths.length - 1); i++) {
          w += widths[i];
          cnt++;
        }
        ops.push(`${mm(w / cnt).toFixed(3)} w`);
        ops.push(strokePath(slice));
      }
    } else {
      ops.push(`${mm(s.widthMm).toFixed(3)} w`);
      ops.push(strokePath(s.pts));
    }
  }
  ops.push("Q");
  const stream = ops.join("\n");

  const objects = [];
  const add = (s) => {
    objects.push(s);
    return objects.length;
  };
  add("<< /Type /Catalog /Pages 2 0 R >>");
  add(`<< /Type /Pages /Kids [3 0 R] /Count 1 >>`);
  add(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W.toFixed(3)} ${H.toFixed(3)}] /Contents 4 0 R /Resources << /ExtGState << /Ink << /Type /ExtGState /BM /Multiply >> >> >> >>`,
  );
  add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);

  let out = "%PDF-1.4\n";
  const xref = [0];
  for (let i = 0; i < objects.length; i++) {
    xref.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const startxref = Buffer.byteLength(out);
  const n = objects.length;
  out += `xref\n0 ${n + 1}\n`;
  out += "0000000000 65535 f \n";
  for (let i = 1; i <= n; i++) {
    out += `${String(xref[i]).padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer << /Size ${n + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;
  return out;
}
