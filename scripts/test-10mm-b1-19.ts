import fs from 'fs';
import { parseExcelFile } from '../src/lib/excel-parser';
import { optimize, evaluateLayoutScore, DEFAULT_SCORING_WEIGHTS } from '../src/lib/nesting';

async function main() {
  const buf = fs.readFileSync('demos/B1-B19.xlsx');
  const file = new File([buf], 'B1-B19.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const parseRes = await parseExcelFile(file);
  const parts10mm = parseRes.parts.filter(p => p.thickness === 10 && p.length <= 6000 && p.width <= 1500);

  console.log(`Testing 10mm Parts from B1-B19.xlsx: ${parts10mm.length} unique parts, ${parts10mm.reduce((s,p) => s + p.qty, 0)} total pieces`);

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

  const res = optimize(parts10mm, config);
  console.log(`\nResult: ${res.sheetCount} sheets, ${res.utilization.toFixed(2)}% utilization`);
  res.sheets.forEach(s => {
    const maxX = Math.max(...s.placed.map(p => p.x + p.w));
    const maxY = Math.max(...s.placed.map(p => p.y + p.h));
    console.log(`  Sheet ${s.id}: ${s.placed.length} parts, Util: ${s.utilization.toFixed(2)}%, maxX: ${maxX}, maxY: ${maxY}`);
    console.log('    First 8 parts:', s.placed.slice(0, 8).map(p => `${p.part.item} (${p.w}x${p.h} @ x=${p.x}, y=${p.y})`).join(', '));
  });
}

main().catch(console.error);
