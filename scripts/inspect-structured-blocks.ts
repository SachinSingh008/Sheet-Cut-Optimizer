import fs from 'fs';
import { parseExcelFile } from '../src/lib/excel-parser';
import { packStructuredBands } from './test-structured-bands';

async function main() {
  const buf = fs.readFileSync('demos/B1-B19.xlsx');
  const file = new File([buf], 'B1-B19.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const parseRes = await parseExcelFile(file);
  const parts10mm = parseRes.parts.filter(p => p.thickness === 10 && p.length <= 6000 && p.width <= 1500);

  const sheets = packStructuredBands(parts10mm as any, 6000, 1500, 3, 0, true);

  sheets.forEach((s, idx) => {
    console.log(`\n======================================================`);
    console.log(`SHEET ${idx + 1} (${s.placed.length} parts, Util: ${s.utilization.toFixed(2)}%)`);
    console.log(`======================================================`);

    // Group placed parts by blockId
    const blockMap = new Map();
    for (const p of s.placed) {
      if (!blockMap.has(p.blockId)) blockMap.set(p.blockId, []);
      blockMap.get(p.blockId).push(p);
    }

    for (const [bId, parts] of blockMap) {
      const minX = Math.min(...parts.map(p => p.x));
      const maxX = Math.max(...parts.map(p => p.x + p.w));
      const minY = Math.min(...parts.map(p => p.y));
      const maxY = Math.max(...parts.map(p => p.y + p.h));
      const first = parts[0];
      console.log(`  Block ${bId.padEnd(20)}: ${parts.length}x ${first.part.item} (${first.w}x${first.h}) -> X: [${minX}, ${maxX}] Y: [${minY}, ${maxY}]`);
    }
  });
}

main().catch(console.error);
