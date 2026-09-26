import fs from 'fs';
import { parseExcelFile } from '../src/lib/excel-parser';

interface PartItem {
  id: string;
  item: string;
  description: string;
  material: string;
  thickness: number;
  length: number;
  width: number;
  qty: number;
}

interface PlacedBlockPart {
  key: string;
  part: PartItem;
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
  blockId: string;
}

interface StructuredSheet {
  id: string;
  sheetLength: number;
  sheetWidth: number;
  placed: PlacedBlockPart[];
  usedArea: number;
  utilization: number;
}

// 6mm Benchmark parts
const PARTS_6MM: PartItem[] = [
  { id:"P010", item:"CL-501", description:"Cleat plate", material:"IS2062 E250A", thickness:6, length:150, width:150, qty:96 },
  { id:"P011", item:"CL-502", description:"Shear cleat", material:"IS2062 E250A", thickness:6, length:260, width:180, qty:64 },
  { id:"P018", item:"WP-905", description:"Walkway plate", material:"IS2062 E250A", thickness:6, length:340, width:120, qty:72 },
  { id:"P019", item:"WP-906", description:"Handrail base", material:"IS2062 E250A", thickness:6, length:120, width:120, qty:120 },
];

/**
 * Prototype of the Structured Industrial Band & Block Nesting Engine
 */
export function packStructuredBands(
  parts: PartItem[],
  sheetLength = 6000,
  sheetWidth = 1500,
  kerf = 3,
  trim = 0,
  allowRotation = true
): StructuredSheet[] {
  const usableL = sheetLength - trim * 2;
  const usableW = sheetWidth - trim * 2;

  // Flatten parts queue
  let unplaced: Array<{ part: PartItem; qId: number }> = [];
  let qCounter = 0;
  for (const p of parts) {
    for (let q = 0; q < p.qty; q++) {
      unplaced.push({ part: p, qId: qCounter++ });
    }
  }

  const sheets: StructuredSheet[] = [];

  while (unplaced.length > 0) {
    const sheetId = `S${String(sheets.length + 1).padStart(2, '0')}`;
    const placed: PlacedBlockPart[] = [];
    let usedArea = 0;

    // Check if there are long parts (> usableW) that must be placed horizontally
    // e.g. B12 (2922 mm) on a 1500 mm wide sheet
    const longParts = unplaced.filter(u => {
      const minDim = Math.min(u.part.length, u.part.width);
      const maxDim = Math.max(u.part.length, u.part.width);
      return maxDim > usableW;
    });

    let currentYStart = trim;

    // If there are long parts, group them into horizontal strips at the bottom/top of the sheet
    if (longParts.length > 0) {
      // Group long parts by width (e.g. 170 mm)
      const longByWidth = new Map<number, typeof longParts>();
      for (const lp of longParts) {
        const w = Math.min(lp.part.length, lp.part.width);
        if (!longByWidth.has(w)) longByWidth.set(w, []);
        longByWidth.get(w)!.push(lp);
      }

      for (const [stripH, items] of longByWidth) {
        // Form horizontal rows of height stripH
        while (items.length > 0 && currentYStart + stripH <= usableW + trim) {
          let rowX = trim;
          // Sort items in row descending by length
          items.sort((a, b) => Math.max(b.part.length, b.part.width) - Math.max(a.part.length, a.part.width));

          const rowItems: typeof items = [];
          for (let i = 0; i < items.length; i++) {
            const it = items[i];
            const itemL = Math.max(it.part.length, it.part.width);
            if (rowX + itemL <= usableL + trim) {
              rowItems.push(it);
              rowX += itemL + kerf;
              items.splice(i, 1);
              i--;
            }
          }

          if (rowItems.length === 0) break;

          // Place row items flush
          let placeX = trim;
          for (const it of rowItems) {
            const itemL = Math.max(it.part.length, it.part.width);
            placed.push({
              key: `${sheetId}-${placed.length}`,
              part: it.part,
              x: placeX,
              y: currentYStart,
              w: itemL,
              h: stripH,
              rotated: it.part.length < it.part.width,
              blockId: `LONG-STRIP-${stripH}`
            });
            usedArea += itemL * stripH;
            placeX += itemL + kerf;
            // Remove from unplaced
            const uIdx = unplaced.findIndex(u => u.qId === it.qId);
            if (uIdx !== -1) unplaced.splice(uIdx, 1);
          }

          currentYStart += stripH + kerf;
        }
      }
    }

    // Now pack the rest of the sheet using VERTICAL BANDS (COLUMNS)
    // Span along Y: from currentYStart to usableW + trim
    const bandSpanY = (usableW + trim) - currentYStart;
    let currentX = trim;

    while (currentX < usableL + trim && unplaced.length > 0) {
      const remainingX = (usableL + trim) - currentX;
      if (remainingX < 50) break;

      // Group unplaced parts by identical dimensions
      const groups = new Map<string, { part: PartItem; l: number; w: number; items: typeof unplaced }>();
      for (const u of unplaced) {
        let l = u.part.length;
        let w = u.part.width;
        if (allowRotation && w > l) [l, w] = [w, l];
        const key = `${u.part.id}_${l}x${w}`;
        if (!groups.has(key)) {
          groups.set(key, { part: u.part, l, w, items: [] });
        }
        groups.get(key)!.items.push(u);
      }

      if (groups.size === 0) break;

      // Evaluate best primary block to start this vertical band
      let bestChoice: {
        group: { part: PartItem; l: number; w: number; items: typeof unplaced };
        orientW: number;
        orientH: number;
        rotated: boolean;
        cols: number;
        rows: number;
        blockW: number;
        blockH: number;
        fillY: number;
      } | null = null;
      let bestScore = -Infinity;

      for (const [, g] of groups) {
        const orientations = [{ w: g.l, h: g.w, rotated: false }];
        if (allowRotation && g.l !== g.w) {
          orientations.push({ w: g.w, h: g.l, rotated: true });
        }

        for (const o of orientations) {
          if (o.w > remainingX || o.h > bandSpanY) continue;

          // How many fit in Y?
          const maxRows = Math.floor((bandSpanY + kerf) / (o.h + kerf));
          if (maxRows <= 0) continue;

          // How many columns?
          const neededCols = Math.ceil(g.items.length / maxRows);
          const maxColsByX = Math.floor((remainingX + kerf) / (o.w + kerf));
          // Test columns from 1 up to min(neededCols, maxColsByX, 10)
          const colsLimit = Math.min(neededCols, maxColsByX);

          for (let c = 1; c <= colsLimit; c++) {
            const partsInBlock = Math.min(g.items.length, c * maxRows);
            const actualRows = Math.min(maxRows, Math.ceil(partsInBlock / c));
            const blockH = actualRows * o.h + (actualRows - 1) * kerf;
            const blockW = c * o.w + (c - 1) * kerf;
            const fillYRatio = blockH / bandSpanY;

            // Check if leftover height above block can be filled by other parts
            const leftoverH = bandSpanY - blockH - kerf;
            let topOffFitBonus = 0;
            if (leftoverH >= 50) {
              for (const u of unplaced) {
                if (u.part.id !== g.part.id) {
                  if (u.part.width <= leftoverH || (allowRotation && u.part.length <= leftoverH)) {
                    topOffFitBonus = 20;
                    break;
                  }
                }
              }
            } else if (leftoverH < 20) {
              // Nearly full width saturation! Excellent!
              topOffFitBonus = 50;
            }

            // Prefer keeping entire group together
            const fullGroupBonus = (partsInBlock === g.items.length) ? 40 : 0;
            // Prefer square-ish or wide blocks over single-column slivers if quantity permits
            const shapeBonus = c > 1 ? 15 : 0;

            const score = fillYRatio * 100 + fullGroupBonus + topOffFitBonus + shapeBonus + partsInBlock * 3;
            if (score > bestScore) {
              bestScore = score;
              bestChoice = {
                group: g,
                orientW: o.w,
                orientH: o.h,
                rotated: o.rotated,
                cols: c,
                rows: actualRows,
                blockW,
                blockH,
                fillY: blockH,
              };
            }
          }
        }
      }

      if (!bestChoice) break;

      const { group, orientW, orientH, rotated, cols, rows, blockW, blockH } = bestChoice;
      const bandBlockId = `BAND-${sheetId}-${placed.length}`;

      // Place the primary block
      let itemsToPlace = group.items.splice(0, cols * rows);
      let pIdx = 0;
      for (let c = 0; c < cols; c++) {
        const colX = currentX + c * (orientW + kerf);
        for (let r = 0; r < rows; r++) {
          if (pIdx >= itemsToPlace.length) break;
          const it = itemsToPlace[pIdx++];
          const partY = currentYStart + r * (orientH + kerf);
          placed.push({
            key: `${sheetId}-${placed.length}`,
            part: it.part,
            x: colX,
            y: partY,
            w: orientW,
            h: orientH,
            rotated,
            blockId: bandBlockId,
          });
          usedArea += orientW * orientH;
          const uIdx = unplaced.findIndex(u => u.qId === it.qId);
          if (uIdx !== -1) unplaced.splice(uIdx, 1);
        }
      }

      // NOW FILL LEFTOVER WIDTH (Top-off space in this band along Y before increasing length X)
      const leftoverH = bandSpanY - blockH - kerf;
      if (leftoverH >= 40 && unplaced.length > 0) {
        let topY = currentYStart + blockH + kerf;

        // Try to find compatible filler groups that fit in leftoverH and blockW
        let fillerFound = true;
        while (fillerFound && topY < currentYStart + bandSpanY && unplaced.length > 0) {
          fillerFound = false;
          const curAvailH = (currentYStart + bandSpanY) - topY;
          if (curAvailH < 40) break;

          // Search unplaced parts for the best filler
          let bestFiller: {
            part: PartItem;
            fw: number;
            fh: number;
            fRotated: boolean;
            fCols: number;
            fRows: number;
            items: typeof unplaced;
          } | null = null;
          let bestFillScore = -Infinity;

          // Group unplaced
          const remGroups = new Map<string, { part: PartItem; l: number; w: number; items: typeof unplaced }>();
          for (const u of unplaced) {
            let l = u.part.length;
            let w = u.part.width;
            if (allowRotation && w > l) [l, w] = [w, l];
            const key = `${u.part.id}_${l}x${w}`;
            if (!remGroups.has(key)) remGroups.set(key, { part: u.part, l, w, items: [] });
            remGroups.get(key)!.items.push(u);
          }

          for (const [, rg] of remGroups) {
            const orients = [{ w: rg.l, h: rg.w, rotated: false }];
            if (allowRotation && rg.l !== rg.w) orients.push({ w: rg.w, h: rg.l, rotated: true });

            for (const fo of orients) {
              if (fo.h <= curAvailH && fo.w <= blockW) {
                const fCols = Math.floor((blockW + kerf) / (fo.w + kerf));
                const fRows = Math.floor((curAvailH + kerf) / (fo.h + kerf));
                if (fCols <= 0 || fRows <= 0) continue;

                const maxCanPlace = Math.min(rg.items.length, fCols * fRows);
                const actualFRows = Math.ceil(maxCanPlace / fCols);
                const actualFH = actualFRows * fo.h + (actualFRows - 1) * kerf;
                const widthCoverage = (fCols * fo.w + (fCols - 1) * kerf) / blockW;
                const score = (actualFH / curAvailH) * 50 + widthCoverage * 50 + maxCanPlace * 2;

                if (score > bestFillScore) {
                  bestFillScore = score;
                  bestFiller = {
                    part: rg.part,
                    fw: fo.w,
                    fh: fo.h,
                    fRotated: fo.rotated,
                    fCols,
                    fRows: actualFRows,
                    items: rg.items,
                  };
                }
              }
            }
          }

          if (bestFiller) {
            const fItems = bestFiller.items.splice(0, bestFiller.fCols * bestFiller.fRows);
            let fi = 0;
            for (let r = 0; r < bestFiller.fRows; r++) {
              const rowY = topY + r * (bestFiller.fh + kerf);
              for (let c = 0; c < bestFiller.fCols; c++) {
                if (fi >= fItems.length) break;
                const it = fItems[fi++];
                const partX = currentX + c * (bestFiller.fw + kerf);
                placed.push({
                  key: `${sheetId}-${placed.length}`,
                  part: it.part,
                  x: partX,
                  y: rowY,
                  w: bestFiller.fw,
                  h: bestFiller.fh,
                  rotated: bestFiller.fRotated,
                  blockId: `${bandBlockId}-TOP`,
                });
                usedArea += bestFiller.fw * bestFiller.fh;
                const uIdx = unplaced.findIndex(u => u.qId === it.qId);
                if (uIdx !== -1) unplaced.splice(uIdx, 1);
              }
            }
            topY += bestFiller.fRows * (bestFiller.fh + kerf);
            fillerFound = true;
          }
        }
      }

      // ONLY WHEN BAND IS FILLED ACROSS WIDTH DO WE INCREASE LENGTH (X)
      currentX += blockW + kerf;
    }

    sheets.push({
      id: sheetId,
      sheetLength,
      sheetWidth,
      placed,
      usedArea,
      utilization: (usedArea / (sheetLength * sheetWidth)) * 100,
    });
  }

  return sheets;
}

async function runTests() {
  console.log("===============================================================");
  console.log("TESTING STRUCTURED BAND NESTING ENGINE ON 6MM BENCHMARK");
  console.log("===============================================================");
  const res6mm = packStructuredBands(PARTS_6MM, 6000, 1250, 3, 0, true);
  console.log(`6mm Result: ${res6mm.length} sheets`);
  res6mm.forEach(s => {
    const maxX = Math.max(...s.placed.map(p => p.x + p.w));
    const maxY = Math.max(...s.placed.map(p => p.y + p.h));
    console.log(`  Sheet ${s.id}: ${s.placed.length} parts, Util: ${s.utilization.toFixed(2)}%, maxX: ${maxX}, maxY: ${maxY}`);
  });

  console.log("\n===============================================================");
  console.log("TESTING STRUCTURED BAND NESTING ENGINE ON 10MM B1-B19 DATASET");
  console.log("===============================================================");
  const buf = fs.readFileSync('demos/B1-B19.xlsx');
  const file = new File([buf], 'B1-B19.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const parseRes = await parseExcelFile(file);
  const parts10mm = parseRes.parts.filter(p => p.thickness === 10 && p.length <= 6000 && p.width <= 1500);

  const res10mm = packStructuredBands(parts10mm as PartItem[], 6000, 1500, 3, 0, true);
  console.log(`10mm Result: ${res10mm.length} sheets`);
  res10mm.forEach(s => {
    const maxX = Math.max(...s.placed.map(p => p.x + p.w));
    const maxY = Math.max(...s.placed.map(p => p.y + p.h));
    console.log(`  Sheet ${s.id}: ${s.placed.length} parts, Util: ${s.utilization.toFixed(2)}%, maxX: ${maxX}, maxY: ${maxY}`);
  });

  // Verify collisions
  let totalCollisions = 0;
  for (const s of [...res6mm, ...res10mm]) {
    for (let i = 0; i < s.placed.length; i++) {
      const a = s.placed[i];
      for (let j = i + 1; j < s.placed.length; j++) {
        const b = s.placed[j];
        if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) {
          totalCollisions++;
        }
      }
    }
  }
  console.log(`\nTotal Collisions across all sheets: ${totalCollisions} (MUST BE 0)`);
}

runTests().catch(console.error);
