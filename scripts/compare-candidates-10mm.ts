import fs from 'fs';
import { parseExcelFile } from '../src/lib/excel-parser';
import {
  packBlockClusterSheet,
  packGuillotineColumnSheet,
  packGuillotineShelfSheet,
  packHierarchicalSheet,
  evaluateLayoutScore,
  DEFAULT_SCORING_WEIGHTS
} from '../src/lib/nesting';

async function main() {
  const buf = fs.readFileSync('demos/B1-B19.xlsx');
  const file = new File([buf], 'B1-B19.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const parseRes = await parseExcelFile(file);
  const parts10mm = parseRes.parts.filter(p => p.thickness === 10 && p.length <= 6000 && p.width <= 1500);

  const config = {
    sheetLength: 6000,
    sheetWidth: 1500,
    kerf: 3,
    trim: 0,
    rotation: true,
    algorithm: "auto",
    preset: "balanced",
    groupByMaterial: false,
    plateTypes: [],
  };

  const queueItems = [];
  for (const p of parts10mm) {
    for (let q = 0; q < p.qty; q++) {
      queueItems.push({ part: p, w: p.length, h: p.width, rotated: false });
    }
  }

  const weights = DEFAULT_SCORING_WEIGHTS.balanced;

  const candidates = [
    { name: "BLOCK-COL", fn: () => packBlockClusterSheet(queueItems, 6000, 1500, config, "IS:2062", 10, "columns", "BC") },
    { name: "BLOCK-SHELF", fn: () => packBlockClusterSheet(queueItems, 6000, 1500, config, "IS:2062", 10, "shelves", "BS") },
    { name: "HIER-COL", fn: () => packHierarchicalSheet(queueItems, 6000, 1500, config, "IS:2062", 10, "columns", "HC") },
    { name: "HIER-SHELF", fn: () => packHierarchicalSheet(queueItems, 6000, 1500, config, "IS:2062", 10, "shelves", "HS") },
    { name: "GUILL-COL", fn: () => packGuillotineColumnSheet(queueItems, 6000, 1500, config, "IS:2062", 10, "GC") },
    { name: "GUILL-SHELF", fn: () => packGuillotineShelfSheet(queueItems, 6000, 1500, config, "IS:2062", 10, "GS") },
  ];

  for (const c of candidates) {
    try {
      const sheets = c.fn();
      const score = evaluateLayoutScore(sheets, weights, config);
      const partsPlaced = sheets.reduce((s, sh) => s + sh.placed.length, 0);
      console.log(`Candidate: ${c.name.padEnd(14)} -> ${sheets.length} sheets, ${partsPlaced} parts, Score: ${score.score.toFixed(2)}, Util: ${score.metrics.utilization.toFixed(2)}%`);
      sheets.forEach(s => {
        const maxX = Math.max(...s.placed.map(p => p.x + p.w));
        console.log(`    ${s.id}: ${s.placed.length} parts, Util: ${s.utilization.toFixed(2)}%, maxX: ${maxX}`);
      });
    } catch (e) {
      console.log(`Candidate ${c.name} failed:`, e.message);
    }
  }
}

main().catch(console.error);
