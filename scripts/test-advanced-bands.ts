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

interface PackOptions {
  sheetLength: number;
  sheetWidth: number;
  kerf: number;
  trim: number;
  allowRotation: boolean;
  bandDirection: "vertical" | "horizontal";
  orderingPolicy: "large-first" | "family-first" | "balanced";
  targetMaxXSheet1?: number; // Optional length cap to balance across 2 sheets
}

/**
 * Advanced Structured Industrial Band & Block Packer
 */
export function packIndustrialBands(
  parts: PartItem[],
  options: PackOptions
): StructuredSheet[] {
  const { sheetLength, sheetWidth, kerf, trim, allowRotation, targetMaxXSheet1 } = options;
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
    const sheetIdx = sheets.length;
    const sheetId = `S${String(sheetIdx + 1).padStart(2, '0')}`;
    const placed: PlacedBlockPart[] = [];
    let usedArea = 0;

    const maxAllowedX = (sheetIdx === 0 && targetMaxXSheet1 && targetMaxXSheet1 > 1000)
      ? Math.min(usableL + trim, targetMaxXSheet1)
      : (usableL + trim);

    // 1. Check for long parts that exceed usable sheet width (e.g. 2922 mm > 1500 mm)
    // These MUST be placed horizontally as full-length strips
    const longParts = unplaced.filter(u => {
      const minDim = Math.min(u.part.length, u.part.width);
      const maxDim = Math.max(u.part.length, u.part.width);
      return maxDim > usableW;
    });

    let currentYStart = trim;

    if (longParts.length > 0) {
      // Group long parts by width (e.g. 170 mm)
      const longByWidth = new Map<number, typeof longParts>();
      for (const lp of longParts) {
        const w = Math.min(lp.part.length, lp.part.width);
        if (!longByWidth.has(w)) longByWidth.set(w, []);
        longByWidth.get(w)!.push(lp);
      }

      for (const [stripH, items] of longByWidth) {
        while (items.length > 0 && currentYStart + stripH <= usableW + trim) {
          let rowX = trim;
          items.sort((a, b) => Math.max(b.part.length, b.part.width) - Math.max(a.part.length, a.part.width));

          const rowItems: typeof items = [];
          for (let i = 0; i < items.length; i++) {
            const it = items[i];
            const itemL = Math.max(it.part.length, it.part.width);
            if (rowX + itemL <= maxAllowedX) {
              rowItems.push(it);
              rowX += itemL + kerf;
              items.splice(i, 1);
              i--;
            }
          }

          if (rowItems.length === 0) break;

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
              blockId: `STRIP-${stripH}`
            });
            usedArea += itemL * stripH;
            placeX += itemL + kerf;
            const uIdx = unplaced.findIndex(u => u.qId === it.qId);
            if (uIdx !== -1) unplaced.splice(uIdx, 1);
          }

          currentYStart += stripH + kerf;
        }
      }
    }

    // 2. Pack using BANDS: either VERTICAL (Columns across Y) or HORIZONTAL (Shelves across X)
    if (options.bandDirection === "horizontal") {
      // Horizontal bands: each band spans along X (0 to maxAllowedX), height along Y (thickness)
      let currentY = trim;
      while (currentY < usableW + trim && unplaced.length > 0) {
        const remainingY = (usableW + trim) - currentY;
        if (remainingY < 40) break;

        const groups = new Map<string, { part: PartItem; l: number; w: number; items: typeof unplaced }>();
        for (const u of unplaced) {
          let l = u.part.length;
          let w = u.part.width;
          if (allowRotation && w > l) [l, w] = [w, l];
          const key = `${u.part.id}_${l}x${w}`;
          if (!groups.has(key)) groups.set(key, { part: u.part, l, w, items: [] });
          groups.get(key)!.items.push(u);
        }
        if (groups.size === 0) break;

        let bestChoice: {
          group: { part: PartItem; l: number; w: number; items: typeof unplaced };
          orientW: number;
          orientH: number;
          rotated: boolean;
          cols: number;
          rows: number;
          blockW: number;
          blockH: number;
        } | null = null;
        let bestScore = -Infinity;

        for (const [, g] of groups) {
          const orientations = [{ w: g.l, h: g.w, rotated: false }];
          if (allowRotation && g.l !== g.w) orientations.push({ w: g.w, h: g.l, rotated: true });

          for (const o of orientations) {
            if (o.w > maxAllowedX || o.h > remainingY) continue;
            const maxCols = Math.floor((maxAllowedX + kerf) / (o.w + kerf));
            if (maxCols <= 0) continue;

            const neededRows = Math.ceil(g.items.length / maxCols);
            const maxRowsByY = Math.floor((remainingY + kerf) / (o.h + kerf));
            const rowsLimit = Math.min(neededRows, maxRowsByY);

            for (let r = 1; r <= rowsLimit; r++) {
              const partsInBlock = Math.min(g.items.length, maxCols * r);
              const actualCols = Math.min(maxCols, Math.ceil(partsInBlock / r));
              const blockW = actualCols * o.w + (actualCols - 1) * kerf;
              const blockH = r * o.h + (r - 1) * kerf;
              const fillXRatio = blockW / maxAllowedX;

              const leftoverW = maxAllowedX - blockW - kerf;
              const fullGroupBonus = (partsInBlock === g.items.length) ? 40 : 0;
              const score = fillXRatio * 120 + fullGroupBonus + (leftoverW < 50 ? 50 : 0) + partsInBlock * 4;

              if (score > bestScore) {
                bestScore = score;
                bestChoice = {
                  group: g,
                  orientW: o.w,
                  orientH: o.h,
                  rotated: o.rotated,
                  cols: actualCols,
                  rows: r,
                  blockW,
                  blockH,
                };
              }
            }
          }
        }

        if (!bestChoice) break;

        const { group, orientW, orientH, rotated, cols, rows, blockW, blockH } = bestChoice;
        const bandBlockId = `SHELF-${sheetId}-${placed.length}`;

        let itemsToPlace = group.items.splice(0, cols * rows);
        let pIdx = 0;
        for (let r = 0; r < rows; r++) {
          const rowY = currentY + r * (orientH + kerf);
          for (let c = 0; c < cols; c++) {
            if (pIdx >= itemsToPlace.length) break;
            const it = itemsToPlace[pIdx++];
            const partX = trim + c * (orientW + kerf);
            placed.push({
              key: `${sheetId}-${placed.length}`,
              part: it.part,
              x: partX,
              y: rowY,
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

        // Fill leftover length in this horizontal band (X from trim + blockW + kerf to maxAllowedX)
        const leftoverW = maxAllowedX - blockW - kerf;
        if (leftoverW >= 40 && unplaced.length > 0) {
          let rightX = trim + blockW + kerf;
          while (rightX < maxAllowedX && unplaced.length > 0) {
            const availW = maxAllowedX - rightX;
            if (availW < 40) break;

            let bestRightFiller: {
              part: PartItem;
              fw: number;
              fh: number;
              fRotated: boolean;
              fCols: number;
              fRows: number;
              items: typeof unplaced;
            } | null = null;
            let bestFillScore = -Infinity;

            const remG = new Map<string, { part: PartItem; l: number; w: number; items: typeof unplaced }>();
            for (const u of unplaced) {
              let l = u.part.length;
              let w = u.part.width;
              if (allowRotation && w > l) [l, w] = [w, l];
              const key = `${u.part.id}_${l}x${w}`;
              if (!remG.has(key)) remG.set(key, { part: u.part, l, w, items: [] });
              remG.get(key)!.items.push(u);
            }

            for (const [, rg] of remG) {
              const orients = [{ w: rg.l, h: rg.w, rotated: false }];
              if (allowRotation && rg.l !== rg.w) orients.push({ w: rg.w, h: rg.l, rotated: true });
              for (const fo of orients) {
                if (fo.w <= availW && fo.h <= blockH) {
                  const fCols = Math.floor((availW + kerf) / (fo.w + kerf));
                  const fRows = Math.floor((blockH + kerf) / (fo.h + kerf));
                  if (fCols <= 0 || fRows <= 0) continue;
                  const canPlace = Math.min(rg.items.length, fCols * fRows);
                  const actualFCols = Math.ceil(canPlace / fRows);
                  const score = (actualFCols * fo.w / availW) * 50 + canPlace * 2;
                  if (score > bestFillScore) {
                    bestFillScore = score;
                    bestRightFiller = {
                      part: rg.part,
                      fw: fo.w,
                      fh: fo.h,
                      fRotated: fo.rotated,
                      fCols: actualFCols,
                      fRows,
                      items: rg.items,
                    };
                  }
                }
              }
            }

            if (!bestRightFiller) break;
            const fItems = bestRightFiller.items.splice(0, bestRightFiller.fCols * bestRightFiller.fRows);
            let fi = 0;
            for (let c = 0; c < bestRightFiller.fCols; c++) {
              const partX = rightX + c * (bestRightFiller.fw + kerf);
              for (let r = 0; r < bestRightFiller.fRows; r++) {
                if (fi >= fItems.length) break;
                const it = fItems[fi++];
                const rowY = currentY + r * (bestRightFiller.fh + kerf);
                placed.push({
                  key: `${sheetId}-${placed.length}`,
                  part: it.part,
                  x: partX,
                  y: rowY,
                  w: bestRightFiller.fw,
                  h: bestRightFiller.fh,
                  rotated: bestRightFiller.fRotated,
                  blockId: `${bandBlockId}-RIGHT`,
                });
                usedArea += bestRightFiller.fw * bestRightFiller.fh;
                const uIdx = unplaced.findIndex(u => u.qId === it.qId);
                if (uIdx !== -1) unplaced.splice(uIdx, 1);
              }
            }
            rightX += bestRightFiller.fCols * (bestRightFiller.fw + kerf);
          }
        }

        currentY += blockH + kerf;
      }
    } else {
      // 2. Pack using VERTICAL BANDS (COLUMNS)
      // Span along Y: from currentYStart to usableW + trim
      const bandSpanY = (usableW + trim) - currentYStart;
      let currentX = trim;

    while (currentX < maxAllowedX && unplaced.length > 0) {
      const remainingX = maxAllowedX - currentX;
      if (remainingX < 40) break;

      // Group unplaced parts by identical dimensions (Level 1)
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

      // Find the best primary block to start this band
      let bestChoice: {
        group: { part: PartItem; l: number; w: number; items: typeof unplaced };
        orientW: number;
        orientH: number;
        rotated: boolean;
        cols: number;
        rows: number;
        blockW: number;
        blockH: number;
      } | null = null;
      let bestScore = -Infinity;

      for (const [, g] of groups) {
        const orientations = [{ w: g.l, h: g.w, rotated: false }];
        if (allowRotation && g.l !== g.w) {
          orientations.push({ w: g.w, h: g.l, rotated: true });
        }

        for (const o of orientations) {
          if (o.w > remainingX || o.h > bandSpanY) continue;

          const maxRows = Math.floor((bandSpanY + kerf) / (o.h + kerf));
          if (maxRows <= 0) continue;

          const neededCols = Math.ceil(g.items.length / maxRows);
          const maxColsByX = Math.floor((remainingX + kerf) / (o.w + kerf));
          const colsLimit = Math.min(neededCols, maxColsByX);

          for (let c = 1; c <= colsLimit; c++) {
            const partsInBlock = Math.min(g.items.length, c * maxRows);
            const actualRows = Math.min(maxRows, Math.ceil(partsInBlock / c));
            const blockH = actualRows * o.h + (actualRows - 1) * kerf;
            const blockW = c * o.w + (c - 1) * kerf;
            const fillYRatio = blockH / bandSpanY;

            // Check if leftover height can be cleanly topped off
            const leftoverH = bandSpanY - blockH - kerf;
            let topOffFitBonus = 0;
            if (leftoverH >= 40) {
              for (const u of unplaced) {
                if (u.part.id !== g.part.id) {
                  if (u.part.width <= leftoverH || (allowRotation && u.part.length <= leftoverH)) {
                    topOffFitBonus = 25;
                    break;
                  }
                }
              }
            } else if (leftoverH < 20) {
              topOffFitBonus = 60; // Complete width closure!
            }

            const fullGroupBonus = (partsInBlock === g.items.length) ? 40 : 0;
            const shapeBonus = c > 1 ? 15 : 0;

            const score = fillYRatio * 120 + fullGroupBonus + topOffFitBonus + shapeBonus + partsInBlock * 4;
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

      // 3. FILL LEFTOVER WIDTH (Top-off space in this band along Y before increasing length X)
      const leftoverH = bandSpanY - blockH - kerf;
      if (leftoverH >= 40 && unplaced.length > 0) {
        let topY = currentYStart + blockH + kerf;

        let fillerFound = true;
        while (fillerFound && topY < currentYStart + bandSpanY && unplaced.length > 0) {
          fillerFound = false;
          const curAvailH = (currentYStart + bandSpanY) - topY;
          if (curAvailH < 40) break;

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

      // Complete the band across width, then advance in length
      currentX += blockW + kerf;
    }
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

async function testBalancing() {
  const buf = fs.readFileSync('demos/B1-B19.xlsx');
  const file = new File([buf], 'B1-B19.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const parseRes = await parseExcelFile(file);
  const parts10mm = parseRes.parts.filter(p => p.thickness === 10 && p.length <= 6000 && p.width <= 1500);

  console.log("=== Exploring Multi-Trial Sheet Balancing on 10mm parts ===");

  const targetCaps = [6000, 5500, 5000, 4800, 4500, 4200];
  for (const cap of targetCaps) {
    const sheets = packIndustrialBands(parts10mm as any, {
      sheetLength: 6000,
      sheetWidth: 1500,
      kerf: 3,
      trim: 0,
      allowRotation: true,
      bandDirection: "vertical",
      orderingPolicy: "large-first",
      targetMaxXSheet1: cap,
    });

    const s1 = sheets[0];
    const s2 = sheets[1];
    const maxX1 = s1 ? Math.max(...s1.placed.map(p => p.x + p.w)) : 0;
    const maxX2 = s2 ? Math.max(...s2.placed.map(p => p.x + p.w)) : 0;

    console.log(`Cap ${String(cap).padEnd(5)} -> Sheets: ${sheets.length}, TotalUtil: ${((s1.usedArea + (s2?.usedArea||0)) / (sheets.length * 9e6) * 100).toFixed(2)}% | S1: ${s1.utilization.toFixed(1)}% (maxX: ${maxX1}) | S2: ${s2 ? s2.utilization.toFixed(1) + '% (maxX: ' + maxX2 + ')' : 'none'}`);
  }

  console.log("\n=== Testing Horizontal Band Packing on 10mm parts ===");
  const hSheets = packIndustrialBands(parts10mm as any, {
    sheetLength: 6000,
    sheetWidth: 1500,
    kerf: 3,
    trim: 0,
    allowRotation: true,
    bandDirection: "horizontal",
    orderingPolicy: "large-first",
  });
  console.log(`Horizontal Result: ${hSheets.length} sheets`);
  hSheets.forEach(s => {
    const maxX = Math.max(...s.placed.map(p => p.x + p.w));
    const maxY = Math.max(...s.placed.map(p => p.y + p.h));
    console.log(`  Sheet ${s.id}: ${s.placed.length} parts, Util: ${s.utilization.toFixed(1)}%, maxX: ${maxX}, maxY: ${maxY}`);
  });
}

testBalancing().catch(console.error);
