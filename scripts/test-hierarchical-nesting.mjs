import { evaluateLayoutMetrics, evaluateLayoutScore, DEFAULT_SCORING_WEIGHTS } from "../src/lib/nesting.ts";

const PARTS_6MM = [
  { id:"P010", item:"CL-501", description:"Cleat plate", material:"IS2062 E250A", thickness:6, length:150, width:150, qty:96, invalid:null },
  { id:"P011", item:"CL-502", description:"Shear cleat", material:"IS2062 E250A", thickness:6, length:260, width:180, qty:64, invalid:null },
  { id:"P018", item:"WP-905", description:"Walkway plate", material:"IS2062 E250A", thickness:6, length:340, width:120, qty:72, invalid:null },
  { id:"P019", item:"WP-906", description:"Handrail base", material:"IS2062 E250A", thickness:6, length:120, width:120, qty:120, invalid:null },
];

// Example from prompt: 100x500x10, 100x700x5, 200x500x8, 300x300x4, 50x100x20
const USER_PROMPT_EXAMPLE = [
  { id:"UE-1", item:"PL-1", description:"Plate 1", material:"IS2062", thickness:6, length:500, width:100, qty:10, invalid:null },
  { id:"UE-2", item:"PL-2", description:"Plate 2", material:"IS2062", thickness:6, length:700, width:100, qty:5, invalid:null },
  { id:"UE-3", item:"PL-3", description:"Plate 3", material:"IS2062", thickness:6, length:500, width:200, qty:8, invalid:null },
  { id:"UE-4", item:"PL-4", description:"Plate 4", material:"IS2062", thickness:6, length:300, width:300, qty:4, invalid:null },
  { id:"UE-5", item:"PL-5", description:"Plate 5", material:"IS2062", thickness:6, length:100, width:50, qty:20, invalid:null },
];

/**
 * STEP 1: STRICTEST GROUPING (Level 1)
 */
export function buildExactPartGroups(parts, allowRotation = true) {
  const groupMap = new Map();

  for (const p of parts) {
    if (p.invalid || p.qty <= 0) continue;
    let l = p.length;
    let w = p.width;
    if (allowRotation && w > l) {
      [l, w] = [w, l];
    }
    const key = `${p.thickness}|${p.material}|${l}x${w}`;
    const existing = groupMap.get(key);
    if (existing) {
      existing.totalQty += p.qty;
      existing.sourceParts.push(p);
    } else {
      groupMap.set(key, {
        id: `GRP-${groupMap.size + 1}`,
        sourceParts: [p],
        thickness: p.thickness,
        length: l,
        width: w,
        totalQty: p.qty,
        area: l * w,
        perimeter: 2 * (l + w),
        aspectRatio: l / Math.max(1, w),
        material: p.material || "STEEL",
        allowRotation,
      });
    }
  }

  return [...groupMap.values()];
}

/**
 * STEP 2 & 3: COMPATIBLE FAMILIES (Level 2: Length, Level 3: Width)
 */
export function buildDimensionFamilies(groups, allowRotation = true) {
  const dimMap = new Map();

  for (const g of groups) {
    const dims = new Set([g.length, g.width]);
    for (const d of dims) {
      if (!dimMap.has(d)) dimMap.set(d, []);
      dimMap.get(d).push(g);
    }
  }

  const families = [];
  for (const [dim, grps] of dimMap) {
    const totalPieces = grps.reduce((s, g) => s + g.totalQty, 0);
    const totalArea = grps.reduce((s, g) => s + g.totalQty * g.area, 0);
    families.push({
      dimension: dim,
      groups: grps,
      totalPieces,
      totalArea,
    });
  }

  families.sort((a, b) => b.totalArea - a.totalArea || b.totalPieces - a.totalPieces);
  return families;
}

function pruneFreeRectangles(rects) {
  const count = rects.length;
  if (count <= 1) return rects;

  const active = new Array(count).fill(true);
  for (let i = 0; i < count; i++) {
    if (rects[i].w < 2 || rects[i].h < 2) active[i] = false;
  }

  for (let i = 0; i < count; i++) {
    if (!active[i]) continue;
    const r1 = rects[i];
    const r1x2 = r1.x + r1.w;
    const r1y2 = r1.y + r1.h;

    for (let j = 0; j < count; j++) {
      if (i === j || !active[j]) continue;
      const r2 = rects[j];
      if (r1.x >= r2.x && r1.y >= r2.y && r1x2 <= r2.x + r2.w && r1y2 <= r2.y + r2.h) {
        active[i] = false;
        break;
      }
    }
  }

  return rects.filter((_, idx) => active[idx]);
}

function splitFreeRectangles(freeRects, px, py, pw, ph, kerf) {
  const px2 = px + pw + kerf;
  const py2 = py + ph + kerf;
  const nextFree = [];

  for (let i = 0; i < freeRects.length; i++) {
    const r = freeRects[i];
    const rx1 = r.x;
    const ry1 = r.y;
    const rx2 = r.x + r.w;
    const ry2 = r.y + r.h;

    if (px >= rx2 || px2 <= rx1 || py >= ry2 || py2 <= ry1) {
      nextFree.push(r);
      continue;
    }

    if (py > ry1 && py < ry2) {
      nextFree.push({ x: rx1, y: ry1, w: r.w, h: py - ry1 });
    }
    if (py2 > ry1 && py2 < ry2) {
      nextFree.push({ x: rx1, y: py2, w: r.w, h: ry2 - py2 });
    }
    if (px > rx1 && px < rx2) {
      nextFree.push({ x: rx1, y: ry1, w: px - rx1, h: r.h });
    }
    if (px2 > rx1 && px2 < rx2) {
      nextFree.push({ x: px2, y: ry1, w: rx2 - px2, h: r.h });
    }
  }

  return pruneFreeRectangles(nextFree);
}

function dpKnapsack1D(candidates, targetSpan, kerf) {
  if (!candidates || candidates.length === 0) return [];
  const C = targetSpan + kerf;
  if (C <= 0) return [];

  const typeMap = new Map();
  const filtered = [];
  for (const c of candidates) {
    const key = `${c.item.part.id}_${c.w}x${c.h}`;
    const count = typeMap.get(key) || 0;
    const maxNeeded = Math.ceil(targetSpan / Math.max(1, c.spanLen)) + 2;
    if (count < maxNeeded) {
      typeMap.set(key, count + 1);
      filtered.push(c);
    }
  }

  const N = filtered.length;
  const prevItem = new Int32Array(C + 1).fill(-1);
  const prevCap = new Int32Array(C + 1).fill(-1);
  const dp = new Uint8Array(C + 1);
  dp[0] = 1;

  let maxReached = 0;
  for (let i = 0; i < N; i++) {
    const item = filtered[i];
    const weight = item.spanLen + kerf;
    if (weight > C) continue;

    for (let cap = C; cap >= weight; cap--) {
      if (dp[cap - weight] === 1 && dp[cap] === 0) {
        dp[cap] = 1;
        prevItem[cap] = i;
        prevCap[cap] = cap - weight;
        if (cap > maxReached) maxReached = cap;
      }
    }
    if (maxReached >= C - kerf) break;
  }

  let bestCap = maxReached;
  while (bestCap > 0 && dp[bestCap] === 0) bestCap--;

  if (bestCap <= 0) {
    const single = candidates.find(c => c.spanLen <= targetSpan);
    return single ? [single] : [];
  }

  const chosen = [];
  let curr = bestCap;
  while (curr > 0 && prevItem[curr] !== -1) {
    const itemIdx = prevItem[curr];
    chosen.push(filtered[itemIdx]);
    curr = prevCap[curr];
  }

  chosen.sort((a, b) => a.item.part.item.localeCompare(b.item.part.item) || b.spanLen - a.spanLen);
  return chosen;
}

function knapsackHeightDesc(candidates, targetSpan, kerf) {
  if (!candidates || candidates.length === 0) return [];
  const sorted = [...candidates].sort((a, b) => b.spanLen - a.spanLen || a.item.part.item.localeCompare(b.item.part.item));
  const chosen = [];
  let currentSpan = 0;
  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i];
    const nextSpan = currentSpan + (chosen.length > 0 ? kerf : 0) + c.spanLen;
    if (nextSpan <= targetSpan) {
      chosen.push(c);
      currentSpan = nextSpan;
      if (currentSpan >= targetSpan - 3) break;
    }
  }
  return chosen;
}

/**
 * STEP 5, 6, 7, 8, 9: HIERARCHICAL NESTING ENGINE
 * Macro-structure by dimension families + Micro-filling with smaller parts + Sheet consolidation
 */
export function solveHierarchicalOptimization(
  parts,
  sheetLength,
  sheetWidth,
  config,
  material,
  thickness
) {
  const trim = config.trim;
  const kerf = config.kerf;
  const usableL = sheetLength - trim * 2;
  const usableW = sheetWidth - trim * 2;

  // Flatten parts queue
  const queue = [];
  for (const p of parts) {
    if (p.invalid || p.qty <= 0) continue;
    for (let q = 0; q < p.qty; q++) {
      let w = p.length;
      let h = p.width;
      let rotated = false;
      if (config.rotation && h > w) {
        [w, h] = [h, w];
        rotated = true;
      }
      if (w > usableL || h > usableW) {
        if (config.rotation && h <= usableL && w <= usableW) {
          [w, h] = [h, w];
          rotated = !rotated;
        } else {
          continue;
        }
      }
      queue.push({ part: p, w, h, rotated });
    }
  }

  // Ordering policies to evaluate
  const orderingStrategies = [
    { name: "family-columns-dp", mode: "columns" },
    { name: "family-shelves-dp", mode: "shelves" },
  ];

  let bestSheets = [];
  let bestScore = -Infinity;
  const weights = DEFAULT_SCORING_WEIGHTS.balanced;

  for (const strat of orderingStrategies) {
    const sheets = runHierarchicalPass(queue, sheetLength, sheetWidth, config, material, thickness, strat.mode);
    const { score } = evaluateLayoutScore(sheets, weights, config);

    if (
      bestSheets.length === 0 ||
      sheets.length < bestSheets.length ||
      (sheets.length === bestSheets.length && score > bestScore)
    ) {
      bestSheets = sheets;
      bestScore = score;
    }
  }

  return { sheets: bestSheets };
}

function runHierarchicalPass(queue, sheetLength, sheetWidth, config, material, thickness, mode = "columns") {
  const trim = config.trim;
  const kerf = config.kerf;
  const usableL = sheetLength - trim * 2;
  const usableW = sheetWidth - trim * 2;

  let remainingQueue = queue.map((it, idx) => ({ ...it, qId: idx }));
  const sheets = [];

  while (remainingQueue.length > 0) {
    const sheetId = `S${String(sheets.length + 1).padStart(2, '0')}`;
    const placed = [];
    let currentX = trim;
    let currentY = trim;
    let usedArea = 0;
    let index = 0;

    let freeRectangles = [];

    if (mode === "columns") {
      // Macro-placement: Vertical Guillotine Columns of matching dimension families
      while (currentX < sheetLength - trim && remainingQueue.length > 0) {
        const remainingSpaceW = sheetLength - trim - currentX;
        if (remainingSpaceW <= 0) break;

        const widthMap = new Map();
        for (let i = 0; i < remainingQueue.length; i++) {
          const item = remainingQueue[i];
          const canRotate = config.rotation && item.w !== item.h;

          if (item.w <= remainingSpaceW && item.h <= usableW) {
            if (!widthMap.has(item.w)) widthMap.set(item.w, []);
            widthMap.get(item.w).push({ item, h: item.h, w: item.w, rotated: item.rotated, spanLen: item.h });
          }
          if (canRotate && item.h <= remainingSpaceW && item.w <= usableW) {
            if (!widthMap.has(item.h)) widthMap.set(item.h, []);
            widthMap.get(item.h).push({ item, h: item.w, w: item.h, rotated: !item.rotated, spanLen: item.w });
          }
        }

        if (widthMap.size === 0) break;

        let bestWidth = 0;
        let bestCombination = [];
        let bestFillH = 0;

        for (const [w, candidates] of widthMap) {
          const comboDP = dpKnapsack1D(candidates, usableW, kerf);
          const comboDesc = knapsackHeightDesc(candidates, usableW, kerf);
          const fillDP = comboDP.reduce((s, c) => s + c.spanLen, 0) + Math.max(0, comboDP.length - 1) * kerf;
          const fillDesc = comboDesc.reduce((s, c) => s + c.spanLen, 0) + Math.max(0, comboDesc.length - 1) * kerf;

          const combo = fillDP >= fillDesc ? comboDP : comboDesc;
          const comboH = Math.max(fillDP, fillDesc);

          if (comboH > bestFillH || (comboH === bestFillH && w > bestWidth)) {
            bestFillH = comboH;
            bestWidth = w;
            bestCombination = combo;
          }
        }

        if (bestWidth <= 0 || bestCombination.length === 0) break;

        let curColY = trim;
        for (const chosen of bestCombination) {
          placed.push({
            key: `${sheetId}-${index}`,
            part: chosen.item.part,
            x: currentX,
            y: curColY,
            w: chosen.w,
            h: chosen.h,
            rotated: chosen.rotated,
            index: index++,
          });

          usedArea += chosen.w * chosen.h;
          curColY += chosen.h + kerf;

          const remIdx = remainingQueue.findIndex(r => r.qId === chosen.item.qId);
          if (remIdx !== -1) {
            remainingQueue.splice(remIdx, 1);
          }
        }

        const colTopLeftover = sheetWidth - trim - curColY;
        if (colTopLeftover > 10) {
          freeRectangles.push({
            x: currentX,
            y: curColY,
            w: bestWidth,
            h: colTopLeftover,
          });
        }

        currentX += bestWidth + kerf;
      }
    } else {
      // Macro-placement: Horizontal Guillotine Shelves
      while (currentY < sheetWidth - trim && remainingQueue.length > 0) {
        const remainingSpaceH = sheetWidth - trim - currentY;
        if (remainingSpaceH <= 0) break;

        const heightMap = new Map();
        for (let i = 0; i < remainingQueue.length; i++) {
          const item = remainingQueue[i];
          const canRotate = config.rotation && item.w !== item.h;

          if (item.h <= remainingSpaceH && item.w <= usableL) {
            if (!heightMap.has(item.h)) heightMap.set(item.h, []);
            heightMap.get(item.h).push({ item, w: item.w, h: item.h, rotated: item.rotated, spanLen: item.w });
          }
          if (canRotate && item.w <= remainingSpaceH && item.h <= usableL) {
            if (!heightMap.has(item.w)) heightMap.set(item.w, []);
            heightMap.get(item.w).push({ item, w: item.h, h: item.w, rotated: !item.rotated, spanLen: item.h });
          }
        }

        if (heightMap.size === 0) break;

        let bestHeight = 0;
        let bestCombination = [];
        let bestFillL = 0;

        for (const [h, candidates] of heightMap) {
          const comboDP = dpKnapsack1D(candidates, usableL, kerf);
          const comboDesc = knapsackHeightDesc(candidates, usableL, kerf);
          const fillDP = comboDP.reduce((s, c) => s + c.spanLen, 0) + Math.max(0, comboDP.length - 1) * kerf;
          const fillDesc = comboDesc.reduce((s, c) => s + c.spanLen, 0) + Math.max(0, comboDesc.length - 1) * kerf;

          const combo = fillDP >= fillDesc ? comboDP : comboDesc;
          const comboL = Math.max(fillDP, fillDesc);

          if (comboL > bestFillL || (comboL === bestFillL && h > bestHeight)) {
            bestFillL = comboL;
            bestHeight = h;
            bestCombination = combo;
          }
        }

        if (bestHeight <= 0 || bestCombination.length === 0) break;

        let curShelfX = trim;
        for (const chosen of bestCombination) {
          placed.push({
            key: `${sheetId}-${index}`,
            part: chosen.item.part,
            x: curShelfX,
            y: currentY,
            w: chosen.w,
            h: chosen.h,
            rotated: chosen.rotated,
            index: index++,
          });

          usedArea += chosen.w * chosen.h;
          curShelfX += chosen.w + kerf;

          const remIdx = remainingQueue.findIndex(r => r.qId === chosen.item.qId);
          if (remIdx !== -1) {
            remainingQueue.splice(remIdx, 1);
          }
        }

        const shelfRightLeftover = sheetLength - trim - curShelfX;
        if (shelfRightLeftover > 10) {
          freeRectangles.push({
            x: curShelfX,
            y: currentY,
            w: shelfRightLeftover,
            h: bestHeight,
          });
        }

        currentY += bestHeight + kerf;
      }
    }

    // STEP 6: INTELLIGENT REMAINING SPACE FILLING (Level 4 Relaxation)
    if (freeRectangles.length > 0 && remainingQueue.length > 0) {
      freeRectangles = pruneFreeRectangles(freeRectangles);

      let placedAny = true;
      while (placedAny && remainingQueue.length > 0 && freeRectangles.length > 0) {
        placedAny = false;
        let bestItemIdx = -1;
        let bestRectIdx = -1;
        let bestW = 0;
        let bestH = 0;
        let bestRotated = false;
        let bestScore = -Infinity;

        for (let rIdx = 0; rIdx < freeRectangles.length; rIdx++) {
          const rect = freeRectangles[rIdx];

          for (let iIdx = 0; iIdx < remainingQueue.length; iIdx++) {
            const item = remainingQueue[iIdx];
            const canRotate = config.rotation && item.w !== item.h;
            const orientations = [{ w: item.w, h: item.h, rotated: item.rotated }];
            if (canRotate) {
              orientations.push({ w: item.h, h: item.w, rotated: !item.rotated });
            }

            for (const orient of orientations) {
              if (orient.w <= rect.w && orient.h <= rect.h) {
                const areaFit = (orient.w * orient.h) / (rect.w * rect.h);
                const score = areaFit * 1000 + orient.w * orient.h;
                if (score > bestScore) {
                  bestScore = score;
                  bestItemIdx = iIdx;
                  bestRectIdx = rIdx;
                  bestW = orient.w;
                  bestH = orient.h;
                  bestRotated = orient.rotated;
                }
              }
            }
          }
        }

        if (bestItemIdx !== -1 && bestRectIdx !== -1) {
          const chosen = remainingQueue[bestItemIdx];
          const rect = freeRectangles[bestRectIdx];

          placed.push({
            key: `${sheetId}-${index}`,
            part: chosen.part,
            x: rect.x,
            y: rect.y,
            w: bestW,
            h: bestH,
            rotated: bestRotated,
            index: index++,
          });

          usedArea += bestW * bestH;
          remainingQueue.splice(bestItemIdx, 1);
          placedAny = true;

          freeRectangles = splitFreeRectangles(freeRectangles, rect.x, rect.y, bestW, bestH, kerf);
        }
      }
    }

    if (placed.length === 0) break;

    sheets.push({
      id: sheetId,
      material,
      thickness,
      sheetLength,
      sheetWidth,
      placed,
      usedArea,
      utilization: (usedArea / (sheetLength * sheetWidth)) * 100,
    });
  }

  // STEP 8: SHEET CONSOLIDATION - ATTEMPT TO ELIMINATE THE LEAST UTILIZED SHEET
  consolidateSheets(sheets, config, kerf, trim);

  return sheets;
}

function consolidateSheets(sheets, config, kerf, trim) {
  if (sheets.length <= 1) return;

  let canEliminate = true;
  while (canEliminate && sheets.length > 1) {
    canEliminate = false;
    const lastSheetIdx = sheets.length - 1;
    const lastSheet = sheets[lastSheetIdx];
    const candidateParts = [...lastSheet.placed].sort((a, b) => b.w * b.h - a.w * a.h);

    const earlierSheets = sheets.slice(0, lastSheetIdx);
    const candidateArea = candidateParts.reduce((s, p) => s + p.w * p.h, 0);
    const availableArea = earlierSheets.reduce((s, sh) => s + (sh.sheetLength * sh.sheetWidth - sh.usedArea), 0);

    if (candidateArea > availableArea) break;

    let tempEarlier = earlierSheets.map(s => ({
      ...s,
      placed: [...s.placed],
      usedArea: s.usedArea,
    }));

    let allMoved = true;
    for (const part of candidateParts) {
      let placedInEarlier = false;

      for (const targetSheet of tempEarlier) {
        const freeSpaces = calculateSheetFreeRectangles(targetSheet, kerf, trim);
        for (const freeRect of freeSpaces) {
          const orientations = [{ w: part.w, h: part.h, rotated: part.rotated }];
          if (config.rotation && part.w !== part.h) {
            orientations.push({ w: part.h, h: part.w, rotated: !part.rotated });
          }

          for (const orient of orientations) {
            if (orient.w <= freeRect.w && orient.h <= freeRect.h) {
              targetSheet.placed.push({
                ...part,
                x: freeRect.x,
                y: freeRect.y,
                w: orient.w,
                h: orient.h,
                rotated: orient.rotated,
              });
              targetSheet.usedArea += orient.w * orient.h;
              targetSheet.utilization = (targetSheet.usedArea / (targetSheet.sheetLength * targetSheet.sheetWidth)) * 100;
              placedInEarlier = true;
              break;
            }
          }
          if (placedInEarlier) break;
        }
        if (placedInEarlier) break;
      }

      if (!placedInEarlier) {
        allMoved = false;
        break;
      }
    }

    if (allMoved) {
      sheets.length = 0;
      sheets.push(...tempEarlier);
      canEliminate = true;
    }
  }
}

function calculateSheetFreeRectangles(sheet, kerf, trim) {
  let freeRects = [{
    x: trim,
    y: trim,
    w: sheet.sheetLength - trim * 2,
    h: sheet.sheetWidth - trim * 2,
  }];

  for (const p of sheet.placed) {
    freeRects = splitFreeRectangles(freeRects, p.x, p.y, p.w, p.h, kerf);
  }

  return freeRects;
}

function checkCollisions(sheets) {
  let collisions = 0;
  for (const s of sheets) {
    for (let i = 0; i < s.placed.length; i++) {
      const a = s.placed[i];
      if (a.x < 0 || a.y < 0 || a.x + a.w > s.sheetLength || a.y + a.h > s.sheetWidth) collisions++;
      for (let j = i + 1; j < s.placed.length; j++) {
        const b = s.placed[j];
        if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) collisions++;
      }
    }
  }
  return collisions;
}

console.log("===============================================================");
console.log("TEST 1: 6MM BENCHMARK (352 Pieces) ON 6000 × 1250 MM");
console.log("===============================================================");
const conf1 = { sheetLength: 6000, sheetWidth: 1250, kerf: 3, trim: 0, rotation: true };
const res1 = solveHierarchicalOptimization(PARTS_6MM, 6000, 1250, conf1, "IS2062", 6);
console.log(`- Sheets: ${res1.sheets.length}, Collisions: ${checkCollisions(res1.sheets)}`);
res1.sheets.forEach(s => {
  const maxX = Math.max(...s.placed.map(p => p.x + p.w));
  console.log(`    ${s.id}: ${s.placed.length} parts, Util: ${s.utilization.toFixed(2)}%, maxX: ${maxX} mm (Remnant: ${6000 - maxX} mm)`);
});

console.log("\n===============================================================");
console.log("TEST 2: USER PROMPT EXAMPLE (500x100, 700x100, 500x200, 300x300, 50x100)");
console.log("===============================================================");
const conf2 = { sheetLength: 3000, sheetWidth: 1500, kerf: 3, trim: 0, rotation: true };
const res2 = solveHierarchicalOptimization(USER_PROMPT_EXAMPLE, 3000, 1500, conf2, "IS2062", 6);
console.log(`- Sheets: ${res2.sheets.length}, Collisions: ${checkCollisions(res2.sheets)}`);
res2.sheets.forEach(s => {
  const maxX = Math.max(...s.placed.map(p => p.x + p.w));
  console.log(`    ${s.id}: ${s.placed.length} parts, Util: ${s.utilization.toFixed(2)}%, maxX: ${maxX} mm (Remnant: ${3000 - maxX} mm)`);
});
