import fs from 'fs';
import { parseExcelFile } from '../src/lib/excel-parser';
import {
  packGuillotineColumnSheet,
  gravityCompactSheet,
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
  };

  const queueItems = [];
  for (const p of parts10mm) {
    for (let q = 0; q < p.qty; q++) {
      queueItems.push({ part: p, w: p.length, h: p.width, rotated: false });
    }
  }

  const rawSheets = packGuillotineColumnSheet(queueItems, 6000, 1500, config, "IS:2062", 10, "GC");
  console.log("RAW GUILL-COL Sheet 1 placed:", rawSheets[0].placed.length, "maxX:", Math.max(...rawSheets[0].placed.map(p => p.x + p.w)));
  console.log("RAW GUILL-COL Sheet 2 placed:", rawSheets[1].placed.length, "maxX:", Math.max(...rawSheets[1].placed.map(p => p.x + p.w)));

  // Count distinct X coordinates in Sheet 2
  const rawXcoords = new Set(rawSheets[1].placed.map(p => p.x));
  console.log("RAW Sheet 2 distinct X coords count:", rawXcoords.size);

  const compactedSheet2 = gravityCompactSheet(rawSheets[1], config);
  const compXcoords = new Set(compactedSheet2.placed.map(p => p.x));
  console.log("COMPACTED Sheet 2 distinct X coords count:", compXcoords.size);

  console.log("\nSample parts before vs after on Sheet 2:");
  for (let i = 0; i < Math.min(10, rawSheets[1].placed.length); i++) {
    const r = rawSheets[1].placed[i];
    const c = compactedSheet2.placed.find(p => p.key === r.key) || compactedSheet2.placed[i];
    console.log(`  Part ${r.part.item} (${r.w}x${r.h}): RAW (x=${r.x}, y=${r.y}) -> COMPACTED (x=${c.x}, y=${c.y})`);
  }
}

main().catch(console.error);
