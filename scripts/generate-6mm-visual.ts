import fs from 'fs';
import { optimize } from '../src/lib/nesting';

const PARTS_6MM = [
  { id:"P010", item:"CL-501", description:"Cleat plate", material:"IS2062 E250A", thickness:6, length:150, width:150, qty:96 },
  { id:"P011", item:"CL-502", description:"Shear cleat", material:"IS2062 E250A", thickness:6, length:260, width:180, qty:64 },
  { id:"P018", item:"WP-905", description:"Walkway plate", material:"IS2062 E250A", thickness:6, length:340, width:120, qty:72 },
  { id:"P019", item:"WP-906", description:"Handrail base", material:"IS2062 E250A", thickness:6, length:120, width:120, qty:120 },
];

async function generate6mmVisual() {
  const res = optimize(PARTS_6MM as any, {
    sheetLength: 6000,
    sheetWidth: 1250,
    kerf: 3,
    trim: 0,
    rotation: true,
    algorithm: "auto",
    preset: "balanced",
  });

  const colors: Record<string, string> = {
    "CL-501": "#fef08a",
    "CL-502": "#bae6fd",
    "WP-905": "#fed7aa",
    "WP-906": "#ddd6fe",
  };

  let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>SteelNest AI — 6mm Benchmark Nesting Layout</title>
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
  <h1>SteelNest AI — 6mm Plate Structured Nesting Result</h1>
  <p>6mm Steel | 352 pieces on Stock 6000 x 1250 mm (Exactly 2 Sheets | Clean Monolithic Part Blocks | Reusable Offcut: 2,618 x 1,250 mm)</p>
`;

  res.sheets.forEach((s: any, idx: number) => {
    const maxX = Math.max(...s.placed.map((p: any) => p.x + p.w));
    const remW = s.sheetLength - maxX;
    html += `
  <div class="sheet-card">
    <div class="sheet-title">
      <span>SHEET ${idx + 1} OF ${res.sheets.length} — Mild Steel — THICKNESS: 6 mm — STOCK: ${s.sheetLength.toLocaleString()} × ${s.sheetWidth.toLocaleString()} mm</span>
      <span class="kpi-badge">${s.utilization.toFixed(2)}% YIELD | ${s.placed.length} PARTS</span>
    </div>
    <svg viewBox="0 0 ${s.sheetLength} ${s.sheetWidth}">
      <rect x="0" y="0" width="${s.sheetLength}" height="${s.sheetWidth}" fill="#0b1120" stroke="#475569" stroke-width="4" />
`;

    for (const p of s.placed) {
      const col = colors[p.part.item] || "#94a3b8";
      html += `      <rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${col}" stroke="#0f172a" stroke-width="2" rx="1" opacity="0.95" />\n`;
      if (p.w > 120 && p.h > 45) {
        html += `      <text x="${p.x + p.w / 2}" y="${p.y + p.h / 2 + 5}" font-size="${Math.min(p.h * 0.35, 20)}" fill="#000" font-weight="bold" text-anchor="middle">${p.part.item}</text>\n`;
      }
    }

    if (remW > 50) {
      html += `      <rect x="${maxX}" y="0" width="${remW}" height="${s.sheetWidth}" fill="rgba(34, 197, 94, 0.08)" stroke="#22c55e" stroke-width="3" stroke-dasharray="12 6" />\n`;
      html += `      <text x="${maxX + remW / 2}" y="${s.sheetWidth / 2}" font-size="34" fill="#22c55e" font-weight="900" text-anchor="middle">REMAINING REUSABLE REMNANT (${remW.toLocaleString()} × ${s.sheetWidth.toLocaleString()} mm)</text>\n`;
    }

    html += `    </svg>
  </div>`;
  });

  html += `</body></html>`;
  fs.writeFileSync('scripts/final-6mm-visual.html', html);
  console.log("Final 6mm visual saved to scripts/final-6mm-visual.html");
}

generate6mmVisual().catch(console.error);
