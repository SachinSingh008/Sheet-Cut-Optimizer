import fs from 'fs';
import { parseExcelFile } from '../src/lib/excel-parser';
import { packIndustrialBands } from './test-advanced-bands';

async function verifyScoreMetrics() {
  const buf = fs.readFileSync('demos/B1-B19.xlsx');
  const file = new File([buf], 'B1-B19.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const parseRes = await parseExcelFile(file);
  const parts10mm = parseRes.parts.filter(p => p.thickness === 10 && p.length <= 6000 && p.width <= 1500);

  // Compare Cap 6000 vs Cap 5500
  const sheets6000 = packIndustrialBands(parts10mm as any, {
    sheetLength: 6000,
    sheetWidth: 1500,
    kerf: 3,
    trim: 0,
    allowRotation: true,
    bandDirection: "vertical",
    orderingPolicy: "large-first",
    targetMaxXSheet1: 6000,
  });

  const sheets5500 = packIndustrialBands(parts10mm as any, {
    sheetLength: 6000,
    sheetWidth: 1500,
    kerf: 3,
    trim: 0,
    allowRotation: true,
    bandDirection: "vertical",
    orderingPolicy: "large-first",
    targetMaxXSheet1: 5500,
  });

  function evaluateMetrics(sheets: typeof sheets6000) {
    const totalArea = sheets.reduce((s, sh) => s + sh.sheetLength * sh.sheetWidth, 0);
    const usedArea = sheets.reduce((s, sh) => s + sh.usedArea, 0);
    const util = (usedArea / totalArea) * 100;

    // Check clustering
    const partPlacements = new Map<string, Array<{ x: number; y: number; w: number; h: number; sheetIdx: number }>>();
    sheets.forEach((sheet, sIdx) => {
      sheet.placed.forEach((p) => {
        const pid = p.part.id;
        if (!partPlacements.has(pid)) partPlacements.set(pid, []);
        partPlacements.get(pid)!.push({ x: p.x, y: p.y, w: p.w, h: p.h, sheetIdx: sIdx });
      });
    });

    let totalClusters = 0;
    let idealClusters = 0;

    for (const [, locs] of partPlacements) {
      if (locs.length <= 1) continue;
      idealClusters += 1;
      const visited = new Set<number>();
      let clustersForPart = 0;
      for (let i = 0; i < locs.length; i++) {
        if (visited.has(i)) continue;
        clustersForPart++;
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
      totalClusters += clustersForPart;
    }

    const clusteringScore = idealClusters > 0 ? (idealClusters / totalClusters) * 100 : 100;

    // Last sheet remnant
    const lastSheet = sheets[sheets.length - 1];
    const maxX = Math.max(...lastSheet.placed.map(p => p.x + p.w));
    const remnantW = lastSheet.sheetLength - maxX;
    const remnantH = lastSheet.sheetWidth;

    return {
      util,
      clusteringScore,
      totalClusters,
      idealClusters,
      remnant: `${remnantW} x ${remnantH} mm (${((remnantW * remnantH) / 1e6).toFixed(3)} m²)`,
      s1Util: sheets[0].utilization.toFixed(1),
      s2Util: sheets[1]?.utilization.toFixed(1),
    };
  }

  console.log("Cap 6000 Metrics:", evaluateMetrics(sheets6000));
  console.log("Cap 5500 Metrics:", evaluateMetrics(sheets5500));
}

verifyScoreMetrics().catch(console.error);
