import fs from 'fs';
import { parseExcelFile } from '../src/lib/excel-parser';
import { optimize } from '../src/lib/nesting';

// 6mm Benchmark parts
const PARTS_6MM = [
  { id:"P010", item:"CL-501", description:"Cleat plate", material:"IS2062 E250A", thickness:6, length:150, width:150, qty:96 },
  { id:"P011", item:"CL-502", description:"Shear cleat", material:"IS2062 E250A", thickness:6, length:260, width:180, qty:64 },
  { id:"P018", item:"WP-905", description:"Walkway plate", material:"IS2062 E250A", thickness:6, length:340, width:120, qty:72 },
  { id:"P019", item:"WP-906", description:"Handrail base", material:"IS2062 E250A", thickness:6, length:120, width:120, qty:120 },
];

function checkCollisions(sheets: any[], kerf: number) {
  let collisions = 0;
  for (const s of sheets) {
    for (let i = 0; i < s.placed.length; i++) {
      const a = s.placed[i];
      for (let j = i + 1; j < s.placed.length; j++) {
        const b = s.placed[j];
        if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) {
          collisions++;
        }
      }
    }
  }
  return collisions;
}

function countGroupsKeptTogether(sheets: any[]) {
  const partPlacements = new Map<string, Array<{ x: number; y: number; w: number; h: number; sheetIdx: number }>>();
  sheets.forEach((sheet, sIdx) => {
    sheet.placed.forEach((p: any) => {
      const pid = p.part.id;
      if (!partPlacements.has(pid)) partPlacements.set(pid, []);
      partPlacements.get(pid)!.push({ x: p.x, y: p.y, w: p.w, h: p.h, sheetIdx: sIdx });
    });
  });

  let fullyTogether = 0;
  let totalGroups = 0;

  for (const [, locs] of partPlacements) {
    if (locs.length <= 1) continue;
    totalGroups++;
    const visited = new Set<number>();
    let clusters = 0;
    for (let i = 0; i < locs.length; i++) {
      if (visited.has(i)) continue;
      clusters++;
      visited.add(i);
      const queue = [i];
      while (queue.length > 0) {
        const curr = queue.pop()!;
        const a = locs[curr]!;
        for (let j = 0; j < locs.length; j++) {
          if (visited.has(j)) continue;
          const b = locs[j]!;
          if (a.sheetIdx !== b.sheetIdx) continue;
          const xAdj = Math.abs((a.x + a.w + 3) - b.x) <= 3 || Math.abs((b.x + b.w + 3) - a.x) <= 3 || (a.x === b.x && a.w === b.w);
          const yAdj = Math.abs((a.y + a.h + 3) - b.y) <= 3 || Math.abs((b.y + b.h + 3) - a.y) <= 3 || (a.y === b.y && a.h === b.h);
          const xOvl = a.x < b.x + b.w && a.x + a.w > b.x;
          const yOvl = a.y < b.y + b.h && a.y + a.h > b.y;
          if ((xAdj && yOvl) || (yAdj && xOvl) || (xAdj && yAdj)) {
            visited.add(j);
            queue.push(j);
          }
        }
      }
    }
    if (clusters === 1) fullyTogether++;
  }
  return { fullyTogether, totalGroups };
}

async function runFullInspection() {
  console.log("================================================================================");
  console.log("STEELNEST AI — STRUCTURED INDUSTRIAL BAND & BLOCK NESTING ENGINE REPORT");
  console.log("================================================================================");

  // 1. 6mm Benchmark
  const t0_6 = performance.now();
  const res6mm = optimize(PARTS_6MM as any, {
    sheetLength: 6000,
    sheetWidth: 1250,
    kerf: 3,
    trim: 0,
    rotation: true,
    algorithm: "auto",
    preset: "balanced",
  });
  const dur6 = performance.now() - t0_6;

  const col6 = checkCollisions(res6mm.sheets, 3);
  const grp6 = countGroupsKeptTogether(res6mm.sheets);
  const sLast6 = res6mm.sheets[res6mm.sheets.length - 1];
  const maxX6 = Math.max(...sLast6.placed.map((p: any) => p.x + p.w));
  const remW6 = sLast6.sheetLength - maxX6;

  console.log(`\n--- BENCHMARK 1: 6mm Steel (352 pieces) on 6000 x 1250 mm ---`);
  console.log(`- Sheet Count:                 ${res6mm.sheetCount} sheets`);
  console.log(`- Parts Placed:                ${res6mm.sheets.reduce((s: number, sh: any) => s + sh.placed.length, 0)} / 352 pieces`);
  console.log(`- Total Material Utilization:  ${res6mm.utilization.toFixed(2)}%`);
  console.log(`- Waste Percentage:            ${(100 - res6mm.utilization).toFixed(2)}%`);
  console.log(`- Per-Sheet Utilization:`);
  res6mm.sheets.forEach((s: any, idx: number) => {
    const sMaxX = Math.max(...s.placed.map((p: any) => p.x + p.w));
    console.log(`    Sheet ${s.id} (6000x1250 mm): ${s.placed.length} parts, Util: ${s.utilization.toFixed(2)}%, maxX: ${sMaxX} mm`);
  });
  console.log(`- Largest Rectangular Remnant: ${remW6} x ${sLast6.sheetWidth} mm (${((remW6 * sLast6.sheetWidth) / 1e6).toFixed(3)} m²)`);
  console.log(`- Fragmented Waste Regions:    ${res6mm.metrics?.fragmentedWasteArea ? Math.round(res6mm.metrics.fragmentedWasteArea / 1e4) : 0} cm²`);
  console.log(`- Identical Groups Contiguity: ${grp6.fullyTogether} / ${grp6.totalGroups} groups held in monolithic solid blocks`);
  console.log(`- Total Cut Length:            ${(res6mm.metrics?.totalCutLength ?? 0).toLocaleString()} mm`);
  console.log(`- Collision Count:             ${col6} (MUST BE 0)`);
  console.log(`- Runtime:                     ${dur6.toFixed(1)} ms`);

  // 2. 10mm Carbon Steel (B1-B19.xlsx)
  const buf = fs.readFileSync('demos/B1-B19.xlsx');
  const file = new File([buf], 'B1-B19.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const parseRes = await parseExcelFile(file);
  const parts10mm = parseRes.parts.filter(p => p.thickness === 10 && p.length <= 6000 && p.width <= 1500);

  const t0_10 = performance.now();
  const res10mm = optimize(parts10mm as any, {
    sheetLength: 6000,
    sheetWidth: 1500,
    kerf: 3,
    trim: 0,
    rotation: true,
    algorithm: "auto",
    preset: "balanced",
  });
  const dur10 = performance.now() - t0_10;

  const col10 = checkCollisions(res10mm.sheets, 3);
  const grp10 = countGroupsKeptTogether(res10mm.sheets);
  const sLast10 = res10mm.sheets[res10mm.sheets.length - 1];
  const maxX10 = Math.max(...sLast10.placed.map((p: any) => p.x + p.w));
  const remW10 = sLast10.sheetLength - maxX10;

  console.log(`\n--- BENCHMARK 2: 10mm Carbon Steel (155 pieces) on 6000 x 1500 mm ---`);
  console.log(`- Sheet Count:                 ${res10mm.sheetCount} sheets`);
  console.log(`- Parts Placed:                ${res10mm.sheets.reduce((s: number, sh: any) => s + sh.placed.length, 0)} / 155 pieces`);
  console.log(`- Total Material Utilization:  ${res10mm.utilization.toFixed(2)}%`);
  console.log(`- Waste Percentage:            ${(100 - res10mm.utilization).toFixed(2)}%`);
  console.log(`- Per-Sheet Utilization:`);
  res10mm.sheets.forEach((s: any, idx: number) => {
    const sMaxX = Math.max(...s.placed.map((p: any) => p.x + p.w));
    console.log(`    Sheet ${s.id} (6000x1500 mm): ${s.placed.length} parts, Util: ${s.utilization.toFixed(2)}%, maxX: ${sMaxX} mm`);
  });
  console.log(`- Largest Rectangular Remnant: ${remW10} x ${sLast10.sheetWidth} mm (${((remW10 * sLast10.sheetWidth) / 1e6).toFixed(3)} m²)`);
  console.log(`- Fragmented Waste Regions:    ${res10mm.metrics?.fragmentedWasteArea ? Math.round(res10mm.metrics.fragmentedWasteArea / 1e4) : 0} cm²`);
  console.log(`- Identical Groups Contiguity: ${grp10.fullyTogether} / ${grp10.totalGroups} groups held in monolithic solid blocks`);
  console.log(`- Total Cut Length:            ${(res10mm.metrics?.totalCutLength ?? 0).toLocaleString()} mm`);
  console.log(`- Collision Count:             ${col10} (MUST BE 0)`);
  console.log(`- Runtime:                     ${dur10.toFixed(1)} ms`);
  console.log(`================================================================================\n`);
}

runFullInspection().catch(console.error);
