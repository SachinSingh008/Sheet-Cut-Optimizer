import fs from 'fs';
import { parseExcelFile } from '../src/lib/excel-parser';
import { optimize } from '../src/lib/nesting';

async function generateVisualHtml() {
  const buf = fs.readFileSync('demos/B1-B19.xlsx');
  const file = new File([buf], 'B1-B19.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const parseRes = await parseExcelFile(file);
  const parts10mm = parseRes.parts.filter(p => p.thickness === 10 && p.length <= 6000 && p.width <= 1500);

  const res = optimize(parts10mm as any, {
    sheetLength: 6000,
    sheetWidth: 1500,
    kerf: 3,
    trim: 0,
    rotation: true,
    algorithm: "auto",
    preset: "balanced",
  });

  const colors: Record<string, string> = {
    "B12": "#f472b6", // pink
    "B9":  "#60a5fa", // sky blue
    "B8":  "#38bdf8", // cyan
    "B7":  "#4ade80", // bright green
    "B16": "#a78bfa", // purple
    "B1":  "#c084fc", // violet
    "B4":  "#34d399", // emerald
    "B5":  "#fbbf24", // amber
  };

  let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>SteelNest AI — Industrial Band & Block Nesting Layout</title>
  <style>
    body { background: #0f172a; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; margin: 0; }
    h1 { color: #38bdf8; margin: 0 0 6px; font-size: 24px; font-weight: 800; }
    p { color: #94a3b8; font-size: 14px; margin: 0 0 24px; }
    .sheet-card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px; margin-bottom: 28px; box-shadow: 0 10px 25px rgba(0,0,0,0.4); }
    .sheet-title { font-size: 16px; font-weight: 700; color: #f1f5f9; margin-bottom: 12px; display: flex; justify-content: space-between; }
    svg { background: #0b1120; border: 2px solid #475569; border-radius: 6px; width: 100%; height: auto; display: block; }
    .kpi-badge { background: #0284c7; color: #fff; padding: 4px 10px; border-radius: 6px; font-size: 13px; font-weight: 700; }
  </style>
</head>
<body>
  <h1>SteelNest AI — Structured Industrial Band & Block Nesting Layout</h1>
  <p>10mm Carbon Steel | 155 parts across 2 sheets (Zero Confetti | Width-First Column & Macro-Strip Alignment | Monolithic Part Blocks)</p>
`;

  res.sheets.forEach((s: any, idx: number) => {
    const maxX = Math.max(...s.placed.map((p: any) => p.x + p.w));
    const remW = s.sheetLength - maxX;
    html += `
  <div class="sheet-card">
    <div class="sheet-title">
      <span>SHEET ${idx + 1} OF ${res.sheets.length} — Carbon Steel — THICKNESS: 10 mm — STOCK: ${s.sheetLength.toLocaleString()} × ${s.sheetWidth.toLocaleString()} mm</span>
      <span class="kpi-badge">${s.utilization.toFixed(2)}% YIELD | ${s.placed.length} PARTS</span>
    </div>
    <svg viewBox="0 0 ${s.sheetLength} ${s.sheetWidth}">
      <!-- Stock boundary -->
      <rect x="0" y="0" width="${s.sheetLength}" height="${s.sheetWidth}" fill="#0b1120" stroke="#475569" stroke-width="4" />
`;

    // Draw parts
    for (const p of s.placed) {
      const col = colors[p.part.item] || "#94a3b8";
      html += `      <rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${col}" stroke="#0f172a" stroke-width="2" rx="1" opacity="0.95" />\n`;
      if (p.w > 120 && p.h > 45) {
        html += `      <text x="${p.x + p.w / 2}" y="${p.y + p.h / 2 + 5}" font-size="${Math.min(p.h * 0.35, 24)}" fill="#000" font-weight="bold" text-anchor="middle">${p.part.item}</text>\n`;
        html += `      <text x="${p.x + p.w / 2}" y="${p.y + p.h / 2 + 20}" font-size="${Math.min(p.h * 0.22, 14)}" fill="#333" font-weight="600" text-anchor="middle">${p.w} × ${p.h}</text>\n`;
      }
    }

    // Draw clean rectangular remnant
    if (remW > 50) {
      html += `      <rect x="${maxX}" y="0" width="${remW}" height="${s.sheetWidth}" fill="rgba(34, 197, 94, 0.08)" stroke="#22c55e" stroke-width="3" stroke-dasharray="12 6" />\n`;
      html += `      <text x="${maxX + remW / 2}" y="${s.sheetWidth / 2}" font-size="38" fill="#22c55e" font-weight="900" text-anchor="middle">REMAINING RECTANGULAR REMNANT (${remW.toLocaleString()} × ${s.sheetWidth.toLocaleString()} mm)</text>\n`;
    }

    html += `    </svg>
  </div>`;
  });

  html += `</body></html>`;
  fs.writeFileSync('scripts/final-industrial-nesting-visual.html', html);
  console.log("Final industrial visual saved to scripts/final-industrial-nesting-visual.html");
}

generateVisualHtml().catch(console.error);
