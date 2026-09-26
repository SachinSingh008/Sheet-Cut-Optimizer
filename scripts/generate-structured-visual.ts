import fs from 'fs';
import { parseExcelFile } from '../src/lib/excel-parser';

// Read test-structured-bands and render SVG HTML
async function renderHtmlVisual() {
  const buf = fs.readFileSync('demos/B1-B19.xlsx');
  const file = new File([buf], 'B1-B19.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const parseRes = await parseExcelFile(file);
  const parts10mm = parseRes.parts.filter(p => p.thickness === 10 && p.length <= 6000 && p.width <= 1500);

  // Import packStructuredBands
  const { packStructuredBands } = await import('./test-structured-bands.ts');
  const sheets = packStructuredBands(parts10mm as any, 6000, 1500, 3, 0, true);

  const colors = [
    '#38bdf8', '#fbbf24', '#34d399', '#f472b6', '#a78bfa',
    '#f87171', '#4ade80', '#fb923c', '#2dd4bf', '#818cf8',
    '#e879f9', '#93c5fd', '#fca5a5', '#86efac', '#fde047'
  ];
  const partColorMap = new Map();
  let cIdx = 0;

  let html = `<!DOCTYPE html>
<html>
<head>
  <title>Structured Band Nesting Visual - 10mm Steel</title>
  <style>
    body { background: #0b1120; color: #f8fafc; font-family: sans-serif; padding: 20px; }
    .sheet-card { background: #1e293b; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
    svg { background: #0f172a; border: 2px solid #475569; width: 100%; height: auto; display: block; }
    .title { font-size: 18px; font-weight: bold; margin-bottom: 8px; }
  </style>
</head>
<body>
  <h1>Structured Industrial Band & Block Nesting Result</h1>
  <p>10mm Plate: 155 parts across 2 sheets (Zero Confetti, Band/Row Alignment)</p>
`;

  sheets.forEach((s, idx) => {
    const maxX = Math.max(...s.placed.map(p => p.x + p.w));
    html += `
  <div class="sheet-card">
    <div class="title">Sheet ${idx + 1} of ${sheets.length} - ${s.sheetLength} x ${s.sheetWidth} mm (Util: ${s.utilization.toFixed(2)}%, Placed: ${s.placed.length} parts, MaxX: ${maxX} mm)</div>
    <svg viewBox="0 0 ${s.sheetLength} ${s.sheetWidth}">
      <!-- Sheet background -->
      <rect x="0" y="0" width="${s.sheetLength}" height="${s.sheetWidth}" fill="#1e293b" stroke="#64748b" stroke-width="4" />
      
      <!-- Placed parts -->
`;
    for (const p of s.placed) {
      if (!partColorMap.has(p.part.item)) {
        partColorMap.set(p.part.item, colors[cIdx++ % colors.length]);
      }
      const col = partColorMap.get(p.part.item);
      html += `      <rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${col}" stroke="#0f172a" stroke-width="2" rx="2" opacity="0.9" />\n`;
      if (p.w > 100 && p.h > 40) {
        html += `      <text x="${p.x + p.w / 2}" y="${p.y + p.h / 2 + 5}" font-size="${Math.min(p.h * 0.4, 24)}" fill="#000" font-weight="bold" text-anchor="middle">${p.part.item} (${p.w}x${p.h})</text>\n`;
      }
    }

    // Draw Remnant rectangle
    if (maxX < s.sheetLength) {
      const remW = s.sheetLength - maxX;
      html += `      <rect x="${maxX}" y="0" width="${remW}" height="${s.sheetWidth}" fill="none" stroke="#22c55e" stroke-width="3" stroke-dasharray="10 5" />\n`;
      html += `      <text x="${maxX + remW / 2}" y="${s.sheetWidth / 2}" font-size="32" fill="#22c55e" font-weight="bold" text-anchor="middle">REMAINING REMNANT (${remW} x ${s.sheetWidth} mm)</text>\n`;
    }

    html += `    </svg>
  </div>`;
  });

  html += `</body></html>`;
  fs.writeFileSync('scripts/structured-band-visual.html', html);
  console.log("Visual HTML saved to scripts/structured-band-visual.html");
}

renderHtmlVisual().catch(console.error);
