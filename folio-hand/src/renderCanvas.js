export function drawPage(ctx, page, pxW, pxH) {
  const { wMm: w, hMm: h, color } = page.paper;
  const sx = pxW / w;
  const sy = pxH / h;
  ctx.save();
  ctx.scale(sx, sy);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);

  const flipY = (x, y) => [x, h - y];

  ctx.strokeStyle = "#c9bfae";
  ctx.lineWidth = 0.12;
  for (const ln of page.laid || []) {
    ctx.globalAlpha = ln.a;
    ctx.beginPath();
    ctx.moveTo(0, h - ln.y);
    ctx.lineTo(w, h - ln.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const g of page.grain || []) {
    const [x, y] = flipY(g.x, g.y);
    ctx.fillStyle = `rgba(106,94,78,${g.a})`;
    ctx.beginPath();
    ctx.arc(x, y, g.r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = page.ink;
  for (const r of page.inkRibbons || []) {
    const pg = r.polygon || [];
    if (pg.length < 3) continue;
    ctx.beginPath();
    const [x0, y0] = flipY(pg[0][0], pg[0][1]);
    ctx.moveTo(x0, y0);
    for (let i = 1; i < pg.length; i++) {
      const [x, y] = flipY(pg[i][0], pg[i][1]);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = page.ink;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (!(page.inkRibbons || []).length) for (const s of page.inkStrokes || []) {
    if (!s.pts || s.pts.length < 2) continue;
    const widths = s.widths;
    if (widths && widths.length === s.pts.length) {
      for (let i = 1; i < s.pts.length; i++) {
        ctx.lineWidth = (widths[i - 1] + widths[i]) / 2;
        ctx.beginPath();
        const [x0, y0] = flipY(s.pts[i - 1][0], s.pts[i - 1][1]);
        const [x1, y1] = flipY(s.pts[i][0], s.pts[i][1]);
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
    } else {
      ctx.lineWidth = s.widthMm;
      ctx.beginPath();
      const [x0, y0] = flipY(s.pts[0][0], s.pts[0][1]);
      ctx.moveTo(x0, y0);
      for (let i = 1; i < s.pts.length; i++) {
        const [x, y] = flipY(s.pts[i][0], s.pts[i][1]);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  ctx.fillStyle = page.ink;
  for (const d of page.dots || []) {
    const [x, y] = flipY(d.x, d.y);
    ctx.beginPath();
    ctx.arc(x, y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";

  ctx.strokeStyle = page.pencilColor;
  ctx.lineWidth = page.pencilWidth;
  ctx.lineCap = "round";
  for (const s of page.pencil || []) {
    const a = flipY(s.a[0], s.a[1]);
    const b = flipY(s.b[0], s.b[1]);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
  ctx.restore();
}
