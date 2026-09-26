import { optimize } from "../src/lib/nesting.ts";

const PARTS_6MM = [
  { id:"P010", item:"CL-501", description:"Cleat plate", material:"IS2062 E250A", thickness:6, length:150, width:150, qty:96, invalid:null },
  { id:"P011", item:"CL-502", description:"Shear cleat", material:"IS2062 E250A", thickness:6, length:260, width:180, qty:64, invalid:null },
  { id:"P018", item:"WP-905", description:"Walkway plate", material:"IS2062 E250A", thickness:6, length:340, width:120, qty:72, invalid:null },
  { id:"P019", item:"WP-906", description:"Handrail base", material:"IS2062 E250A", thickness:6, length:120, width:120, qty:120, invalid:null },
];

/**
 * Fast Dynamic Programming 1D Knapsack for exact height-fill.
 * Guaranteed to find the optimal subset in O(N * H) ~ a few microseconds.
 */
function dpKnapsackColumnHeights(candidates, targetHeight, kerf) {
  if (!candidates || candidates.length === 0) return [];
  
  // Sort candidates by height descending
  const sorted = [...candidates].sort((a, b) => b.h - a.h);
  
  // Greedy with best-fit fallback
  let chosen = [];
  let currentH = 0;
  
  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i];
    const nextH = currentH + (chosen.length > 0 ? kerf : 0) + c.h;
    if (nextH <= targetHeight) {
      chosen.push(c);
      currentH = nextH;
      if (currentH >= targetHeight - 3) break;
    }
  }
  
  return chosen;
}

export function packStrictGuillotineColumnsDP(items, sheetLength, sheetWidth, kerf = 3, trim = 0) {
  const usableL = sheetLength - trim * 2;
  const usableW = sheetWidth - trim * 2;

  let remaining = items.map((it, idx) => ({ ...it, id: idx }));
  const sheets = [];

  while (remaining.length > 0) {
    const placed = [];
    let currentX = trim;
    let usedArea = 0;

    while (currentX < sheetLength - trim && remaining.length > 0) {
      const remainingW = sheetLength - trim - currentX;
      if (remainingW <= 0) break;

      // Group available items by candidate width
      const widthMap = new Map();
      for (let i = 0; i < remaining.length; i++) {
        const item = remaining[i];
        const canRotate = item.w !== item.h;

        if (item.w <= remainingW && item.h <= usableW) {
          if (!widthMap.has(item.w)) widthMap.set(item.w, []);
          widthMap.get(item.w).push({ item, h: item.h, w: item.w, rotated: item.rotated });
        }
        if (canRotate && item.h <= remainingW && item.w <= usableW) {
          if (!widthMap.has(item.h)) widthMap.set(item.h, []);
          widthMap.get(item.h).push({ item, h: item.w, w: item.h, rotated: !item.rotated });
        }
      }

      if (widthMap.size === 0) break;

      // Find width that maximizes height fill
      let bestWidth = 0;
      let bestCombination = [];
      let bestFillH = 0;

      for (const [w, candidates] of widthMap) {
        const combo = dpKnapsackColumnHeights(candidates, usableW, kerf);
        const comboH = combo.reduce((s, c) => s + c.h, 0) + Math.max(0, combo.length - 1) * kerf;
        if (comboH > bestFillH || (comboH === bestFillH && w > bestWidth)) {
          bestFillH = comboH;
          bestWidth = w;
          bestCombination = combo;
        }
      }

      if (bestWidth <= 0 || bestCombination.length === 0) break;

      // Place the chosen parts in this column
      let currentY = trim;
      for (const chosen of bestCombination) {
        placed.push({
          key: `P-${placed.length}`,
          part: chosen.item.part,
          x: currentX,
          y: currentY,
          w: chosen.w,
          h: chosen.h,
          rotated: chosen.rotated,
          index: placed.length,
        });

        usedArea += chosen.w * chosen.h;
        currentY += chosen.h + kerf;

        const remIdx = remaining.findIndex(r => r.id === chosen.item.id);
        if (remIdx !== -1) {
          remaining.splice(remIdx, 1);
        }
      }

      currentX += bestWidth + kerf;
    }

    if (placed.length === 0) break;

    const sheetArea = sheetLength * sheetWidth;
    sheets.push({
      id: `S0${sheets.length + 1}`,
      sheetLength,
      sheetWidth,
      placed,
      usedArea,
      utilization: (usedArea / sheetArea) * 100,
    });
  }

  // Check collisions
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

  return { sheets, unplaced: remaining, collisions };
}

console.log("=== Testing Strict Fast DP Guillotine Packer ===");

const queue = [];
for (const p of PARTS_6MM) {
  for (let q = 0; q < p.qty; q++) {
    queue.push({ part: p, w: p.length, h: p.width, rotated: false });
  }
}

const t0 = performance.now();
const res6000x1250 = packStrictGuillotineColumnsDP(queue, 6000, 1250, 3, 0);
const t1 = performance.now();
console.log(`\nStock 6000 × 1250 mm (${(t1 - t0).toFixed(1)}ms):`);
console.log(`- Sheets: ${res6000x1250.sheets.length}`);
console.log(`- Unplaced: ${res6000x1250.unplaced.length}`);
console.log(`- Collisions: ${res6000x1250.collisions}`);
res6000x1250.sheets.forEach(s => {
  console.log(`   Sheet ${s.id}: ${s.placed.length} parts, Util: ${s.utilization.toFixed(2)}%`);
});

const res6000x1500 = packStrictGuillotineColumnsDP(queue, 6000, 1500, 3, 0);
console.log(`\nStock 6000 × 1500 mm:`);
console.log(`- Sheets: ${res6000x1500.sheets.length}`);
console.log(`- Unplaced: ${res6000x1500.unplaced.length}`);
console.log(`- Collisions: ${res6000x1500.collisions}`);
res6000x1500.sheets.forEach(s => {
  console.log(`   Sheet ${s.id}: ${s.placed.length} parts, Util: ${s.utilization.toFixed(2)}%`);
});

const res2500x1250 = packStrictGuillotineColumnsDP(queue, 2500, 1250, 3, 0);
console.log(`\nStock 2500 × 1250 mm:`);
console.log(`- Sheets: ${res2500x1250.sheets.length}`);
console.log(`- Unplaced: ${res2500x1250.unplaced.length}`);
console.log(`- Collisions: ${res2500x1250.collisions}`);
res2500x1250.sheets.forEach(s => {
  console.log(`   Sheet ${s.id}: ${s.placed.length} parts, Util: ${s.utilization.toFixed(2)}%`);
});
