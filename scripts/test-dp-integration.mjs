const PARTS_6MM = [
  { id:"P010", item:"CL-501", description:"Cleat plate", material:"IS2062 E250A", thickness:6, length:150, width:150, qty:96, invalid:null },
  { id:"P011", item:"CL-502", description:"Shear cleat", material:"IS2062 E250A", thickness:6, length:260, width:180, qty:64, invalid:null },
  { id:"P018", item:"WP-905", description:"Walkway plate", material:"IS2062 E250A", thickness:6, length:340, width:120, qty:72, invalid:null },
  { id:"P019", item:"WP-906", description:"Handrail base", material:"IS2062 E250A", thickness:6, length:120, width:120, qty:120, invalid:null },
];

function knapsackHeightDesc(candidates, targetHeight, kerf) {
  if (!candidates || candidates.length === 0) return [];
  const sorted = [...candidates].sort((a, b) => b.h - a.h || a.item.part.item.localeCompare(b.item.part.item));
  const chosen = [];
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

function dpKnapsack1D(candidates, targetSpan, kerf) {
  if (!candidates || candidates.length === 0) return [];
  const C = targetSpan + kerf;
  if (C <= 0) return [];

  const typeMap = new Map();
  const filtered = [];
  for (const c of candidates) {
    const key = `${c.item.part.id}_${c.w}x${c.h}`;
    const count = typeMap.get(key) || 0;
    const maxNeeded = Math.ceil(targetSpan / Math.max(1, c.h)) + 2;
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
    const weight = item.h + kerf;
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
    const single = candidates.find(c => c.h <= targetSpan);
    return single ? [single] : [];
  }

  const chosen = [];
  let curr = bestCap;
  while (curr > 0 && prevItem[curr] !== -1) {
    const itemIdx = prevItem[curr];
    chosen.push(filtered[itemIdx]);
    curr = prevCap[curr];
  }

  chosen.sort((a, b) => a.item.part.item.localeCompare(b.item.part.item) || b.h - a.h);
  return chosen;
}

export function packGuillotineColumnsAdvanced(items, curSheetLength, curSheetWidth, config, material, thickness, strategy = "height-desc") {
  const trim = config.trim;
  const kerf = config.kerf;
  const usableL = curSheetLength - trim * 2;
  const usableW = curSheetWidth - trim * 2;

  let remainingQueue = items.map((it, idx) => ({ ...it, qId: idx }));
  const sheets = [];

  while (remainingQueue.length > 0) {
    const sheetId = `COL-${sheets.length + 1}`;
    const placed = [];
    let currentX = trim;
    let usedArea = 0;
    let index = 0;

    while (currentX < curSheetLength - trim && remainingQueue.length > 0) {
      const remainingSpaceW = curSheetLength - trim - currentX;
      if (remainingSpaceW <= 0) break;

      const widthMap = new Map();
      for (let i = 0; i < remainingQueue.length; i++) {
        const item = remainingQueue[i];
        const canRotate = config.rotation && item.w !== item.h;

        if (item.w <= remainingSpaceW && item.h <= usableW) {
          if (!widthMap.has(item.w)) widthMap.set(item.w, []);
          widthMap.get(item.w).push({ item, h: item.h, w: item.w, rotated: item.rotated });
        }
        if (canRotate && item.h <= remainingSpaceW && item.w <= usableW) {
          if (!widthMap.has(item.h)) widthMap.set(item.h, []);
          widthMap.get(item.h).push({ item, h: item.w, w: item.h, rotated: !item.rotated });
        }
      }

      if (widthMap.size === 0) break;

      let bestWidth = 0;
      let bestCombination = [];
      let bestFillH = 0;

      for (const [w, candidates] of widthMap) {
        const combo = strategy === "height-desc"
          ? knapsackHeightDesc(candidates, usableW, kerf)
          : dpKnapsack1D(candidates, usableW, kerf);
        if (combo.length === 0) continue;
        const comboH = combo.reduce((s, c) => s + c.h, 0) + Math.max(0, combo.length - 1) * kerf;
        if (comboH > bestFillH || (comboH === bestFillH && w > bestWidth)) {
          bestFillH = comboH;
          bestWidth = w;
          bestCombination = combo;
        }
      }

      if (bestWidth <= 0 || bestCombination.length === 0) break;

      let currentY = trim;
      for (const chosen of bestCombination) {
        placed.push({
          key: `${sheetId}-${index}`,
          part: chosen.item.part,
          x: currentX,
          y: currentY,
          w: chosen.w,
          h: chosen.h,
          rotated: chosen.rotated,
          index: index++,
        });

        usedArea += chosen.w * chosen.h;
        currentY += chosen.h + kerf;

        const remIdx = remainingQueue.findIndex(r => r.qId === chosen.item.qId);
        if (remIdx !== -1) {
          remainingQueue.splice(remIdx, 1);
        }
      }

      currentX += bestWidth + kerf;
    }

    if (placed.length === 0) break;

    sheets.push({
      id: sheetId,
      material,
      thickness,
      sheetLength: curSheetLength,
      sheetWidth: curSheetWidth,
      placed,
      usedArea,
      utilization: (usedArea / (curSheetLength * curSheetWidth)) * 100,
    });
  }

  return { sheets, unplaced: remainingQueue };
}

export function packGuillotineShelvesAdvanced(items, curSheetLength, curSheetWidth, config, material, thickness, strategy = "height-desc") {
  const trim = config.trim;
  const kerf = config.kerf;
  const usableL = curSheetLength - trim * 2;
  const usableW = curSheetWidth - trim * 2;

  let remainingQueue = items.map((it, idx) => ({ ...it, qId: idx }));
  const sheets = [];

  while (remainingQueue.length > 0) {
    const sheetId = `SHELF-${sheets.length + 1}`;
    const placed = [];
    let currentY = trim;
    let usedArea = 0;
    let index = 0;

    while (currentY < curSheetWidth - trim && remainingQueue.length > 0) {
      const remainingSpaceH = curSheetWidth - trim - currentY;
      if (remainingSpaceH <= 0) break;

      const heightMap = new Map();
      for (let i = 0; i < remainingQueue.length; i++) {
        const item = remainingQueue[i];
        const canRotate = config.rotation && item.w !== item.h;

        if (item.h <= remainingSpaceH && item.w <= usableL) {
          if (!heightMap.has(item.h)) heightMap.set(item.h, []);
          heightMap.get(item.h).push({ item, w: item.w, h: item.h, rotated: item.rotated });
        }
        if (canRotate && item.w <= remainingSpaceH && item.h <= usableL) {
          if (!heightMap.has(item.w)) heightMap.set(item.w, []);
          heightMap.get(item.w).push({ item, w: item.h, h: item.w, rotated: !item.rotated });
        }
      }

      if (heightMap.size === 0) break;

      let bestHeight = 0;
      let bestCombination = [];
      let bestFillL = 0;

      for (const [h, candidates] of heightMap) {
        // Here span is along X (usableL), so candidate dimension is w
        const candidatesForSpan = candidates.map(c => ({ ...c, h: c.w })); // treat w as the span length
        const combo = strategy === "height-desc"
          ? knapsackHeightDesc(candidatesForSpan, usableL, kerf)
          : dpKnapsack1D(candidatesForSpan, usableL, kerf);
        if (combo.length === 0) continue;
        const comboL = combo.reduce((s, c) => s + c.h, 0) + Math.max(0, combo.length - 1) * kerf;
        if (comboL > bestFillL || (comboL === bestFillL && h > bestHeight)) {
          bestFillL = comboL;
          bestHeight = h;
          // restore original w/h
          bestCombination = combo.map(c => ({ item: c.item, w: c.h, h: c.w, rotated: c.rotated }));
        }
      }

      if (bestHeight <= 0 || bestCombination.length === 0) break;

      let currentX = trim;
      for (const chosen of bestCombination) {
        placed.push({
          key: `${sheetId}-${index}`,
          part: chosen.item.part,
          x: currentX,
          y: currentY,
          w: chosen.w,
          h: chosen.h,
          rotated: chosen.rotated,
          index: index++,
        });

        usedArea += chosen.w * chosen.h;
        currentX += chosen.w + kerf;

        const remIdx = remainingQueue.findIndex(r => r.qId === chosen.item.qId);
        if (remIdx !== -1) {
          remainingQueue.splice(remIdx, 1);
        }
      }

      currentY += bestHeight + kerf;
    }

    if (placed.length === 0) break;

    sheets.push({
      id: sheetId,
      material,
      thickness,
      sheetLength: curSheetLength,
      sheetWidth: curSheetWidth,
      placed,
      usedArea,
      utilization: (usedArea / (curSheetLength * curSheetWidth)) * 100,
    });
  }

  return { sheets, unplaced: remainingQueue };
}

const queue = [];
for (const p of PARTS_6MM) {
  for (let q = 0; q < p.qty; q++) {
    queue.push({ part: p, w: p.length, h: p.width, rotated: false });
  }
}

const config = { trim: 0, kerf: 3, rotation: true };

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

console.log("\n--- Verification on Stock Sizes ---");
const testSizes = [
  { l: 6000, w: 1250, name: "6000 × 1250 mm" },
  { l: 6000, w: 1500, name: "6000 × 1500 mm" },
  { l: 2500, w: 1250, name: "2500 × 1250 mm" },
];

for (const sz of testSizes) {
  const r = packGuillotineColumnsAdvanced(queue, sz.l, sz.w, config, "IS2062", 6, "dp-subset");
  const c = checkCollisions(r.sheets);
  console.log(`\nStock ${sz.name}:`);
  console.log(`- Sheets: ${r.sheets.length}, Unplaced: ${r.unplaced.length}, Collisions: ${c}`);
  r.sheets.forEach(s => {
    console.log(`   Sheet ${s.id}: ${s.placed.length} parts, Util: ${s.utilization.toFixed(2)}%`);
  });
}
