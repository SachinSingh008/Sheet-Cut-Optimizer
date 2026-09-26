import fs from 'fs';
import { parseExcelFile } from '../src/lib/excel-parser';

async function main() {
  const buf = fs.readFileSync('demos/B1-B19.xlsx');
  const file = new File([buf], 'B1-B19.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const res = await parseExcelFile(file);
  console.log('Total extracted parts:', res.parts.length);
  const byThk: Record<number, any[]> = {};
  for (const p of res.parts) {
    if (!byThk[p.thickness]) byThk[p.thickness] = [];
    byThk[p.thickness].push(p);
  }
  for (const [thk, parts] of Object.entries(byThk)) {
    const totalQty = parts.reduce((s, p) => s + p.qty, 0);
    const totalAreaM2 = parts.reduce((s, p) => s + (p.length * p.width * p.qty) / 1e6, 0);
    console.log(`\nThickness ${thk}mm: ${parts.length} unique parts, ${totalQty} pieces, ${totalAreaM2.toFixed(3)} m²`);
    parts.forEach(p => console.log(`  ${p.item.padEnd(8)} ${p.length} x ${p.width} mm (qty: ${p.qty}) [${p.description}]`));
  }
}

main().catch(console.error);
