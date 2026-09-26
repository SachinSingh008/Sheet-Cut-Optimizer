import { gravityCompactSheet } from "../src/lib/nesting.ts";

const PARTS_6MM = [
  { id:"P010", item:"CL-501", description:"Cleat plate", material:"IS2062 E250A", thickness:6, length:150, width:150, qty:96, invalid:null },
  { id:"P011", item:"CL-502", description:"Shear cleat", material:"IS2062 E250A", thickness:6, length:260, width:180, qty:64, invalid:null },
  { id:"P018", item:"WP-905", description:"Walkway plate", material:"IS2062 E250A", thickness:6, length:340, width:120, qty:72, invalid:null },
  { id:"P019", item:"WP-906", description:"Handrail base", material:"IS2062 E250A", thickness:6, length:120, width:120, qty:120, invalid:null },
];

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

function pruneFreeRectangles(rects) {
  const count = rects.length;
  if (count <= 1) return rects;
  const active = new Array(count).fill(true);
  for (let i = 0; i < count; i++) {
    if (rects[i].w < 5 || rects[i].h < 5) active[i] = false;
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
    if (py > ry1 && py < ry2) nextFree.push({ x: rx1, y: ry1, w: r.w, h: py - ry1 });
    if (py2 > ry1 && py2 < ry2) nextFree.push({ x: rx1, y: py2, w: r.w, h: ry2 - py2 });
    if (px > rx1 && px < rx2) nextFree.push({ x: rx1, y: ry1, w: px - rx1, h: r.h });
    if (px2 > rx1 && px2 < rx2) nextFree.push({ x: px2, y: ry1, w: rx2 - px2, h: r.h });
  }
  return pruneFreeRectangles(nextFree);
}

// Hierarchical Block & Dimension Cluster Packer
function solveBlockDimensionClustering(parts, sheetLength, sheetWidth, config) {
  const trim = config.trim;
  const kerf = config.kerf;
  const usableL = sheetLength - trim * 2;
  const usableW = sheetWidth - trim * 2;

  // Flatten parts queue with unique qId
  const remaining = [];
  for (const p of parts) {
    if (p.invalid || p.qty <= 0) continue;
    for (let q = 0; q < p.qty; q++) {
      remaining.push({
        qId: remaining.length,
        part: p,
        length: p.length,
        width: p.width,
        area: p.length * p.width,
      });
    }
  }

  const sheets = [];

  while (remaining.length > 0) {
    const sheetId = `S${String(sheets.length + 1).padStart(2, '0')}`;
    const placed = [];
    let currentX = trim;
    let usedArea = 0;
    let index = 0;
    let freeRects = [];

    while (currentX < sheetLength - trim && remaining.length > 0) {
      const remainingX = sheetLength - trim - currentX;
      if (remainingX <= 0) break;

      // Group unplaced parts by identical dimensions
      const exactGroups = new Map();
      for (const item of remaining) {
        let l = item.length;
        let w = item.width;
        if (config.rotation && w > l) [l, w] = [w, l];
        const key = `${l}x${w}`;
        if (!exactGroups.has(key)) {
          exactGroups.set(key, { key, l, w, items: [] });
        }
        exactGroups.get(key).items.push(item);
      }

      // Find the best identical group to place next as a contiguous block/strip
      let bestBlock = null;
      let bestScore = -Infinity;

      for (const [key, g] of exactGroups) {
        // Test Horizontal vs Vertical orientation
        const orientations = [];
        orientations.push({ w: g.l, h: g.w, rotated: false });
        if (config.rotation && g.l !== g.w) {
          orientations.push({ w: g.w, h: g.l, rotated: true });
        }

        for (const orient of orientations) {
          if (orient.w > remainingX || orient.h > usableW) continue;

          const rows = Math.floor((usableW + kerf) / (orient.h + kerf));
          if (rows <= 0) continue;

          const heightUsed = rows * orient.h + (rows - 1) * kerf;
          const fillRatio = heightUsed / usableW;

          // How many columns can this group fill in the remaining space?
          const maxColsBySpace = Math.floor((remainingX + kerf) / (orient.w + kerf));
          const neededCols = Math.ceil(g.items.length / rows);
          const cols = Math.min(maxColsBySpace, neededCols);
          if (cols <= 0) continue;

          // Check if this orientation leaves a top cavity that fits another dimension family!
          const topCavityH = usableW - heightUsed;
          let topFitBonus = 0;
          if (topCavityH > 30) {
            // Check if any other part has a dimension that fits in topCavityH
            for (const other of remaining) {
              if (other.part.id !== g.items[0].part.id) {
                if (other.width <= topCavityH || (config.rotation && other.length <= topCavityH)) {
                  topFitBonus = 25;
                  break;
                }
              }
            }
          }

          // Score: prioritize high vertical fill, keeping parts together, and fitting top remainder
          const partsPlacedInBlock = Math.min(g.items.length, cols * rows);
          const completionBonus = partsPlacedInBlock === g.items.length ? 50 : 0;
          const score = fillRatio * 100 + completionBonus + topFitBonus + partsPlacedInBlock;

          if (score > bestScore) {
            bestScore = score;
            bestBlock = {
              group: g,
              orient,
              rows,
              cols,
              heightUsed,
              blockWidth: cols * orient.w + (cols - 1) * kerf,
            };
          }
        }
      }

      if (!bestBlock) break;

      // Place the block of identical parts
      const { group, orient, rows, cols, heightUsed, blockWidth } = bestBlock;
      let blockPlacedCount = 0;

      for (let c = 0; c < cols; c++) {
        const colX = currentX + c * (orient.w + kerf);
        for (let r = 0; r < rows; r++) {
          if (group.items.length === 0) break;
          const item = group.items.pop();
          const partY = trim + r * (orient.h + kerf);

          placed.push({
            key: `${sheetId}-${index}`,
            part: item.part,
            x: colX,
            y: partY,
            w: orient.w,
            h: orient.h,
            rotated: orient.rotated,
            index: index++,
          });

          usedArea += orient.w * orient.h;
          blockPlacedCount++;

          const remIdx = remaining.findIndex(it => it.qId === item.qId);
          if (remIdx !== -1) remaining.splice(remIdx, 1);
        }
      }

      // Register the empty cavity directly ABOVE this block
      const topCavityH = usableW - heightUsed;
      if (topCavityH > 30) {
        freeRects.push({
          x: currentX,
          y: trim + heightUsed + kerf,
          w: blockWidth,
          h: topCavityH,
        });
      }

      currentX += blockWidth + kerf;
    }

    // Step 6: Fill all rectangular cavities above blocks with unplaced parts
    if (freeRects.length > 0 && remaining.length > 0) {
      freeRects = pruneFreeRectangles(freeRects);

      let placedAny = true;
      while (placedAny && remaining.length > 0 && freeRects.length > 0) {
        placedAny = false;
        let bestItemIdx = -1;
        let bestRectIdx = -1;
        let bestW = 0;
        let bestH = 0;
        let bestRotated = false;
        let bestScore = -Infinity;

        for (let rIdx = 0; rIdx < freeRects.length; rIdx++) {
          const rect = freeRects[rIdx];
          for (let iIdx = 0; iIdx < remaining.length; iIdx++) {
            const item = remaining[iIdx];
            const orientations = [{ w: item.length, h: item.width, rotated: false }];
            if (config.rotation && item.length !== item.width) {
              orientations.push({ w: item.width, h: item.length, rotated: true });
            }

            for (const o of orientations) {
              if (o.w <= rect.w && o.h <= rect.h) {
                const areaFit = (o.w * o.h) / (rect.w * rect.h);
                const score = areaFit * 1000 + o.w * o.h;
                if (score > bestScore) {
                  bestScore = score;
                  bestItemIdx = iIdx;
                  bestRectIdx = rIdx;
                  bestW = o.w;
                  bestH = o.h;
                  bestRotated = o.rotated;
                }
              }
            }
          }
        }

        if (bestItemIdx !== -1 && bestRectIdx !== -1) {
          const item = remaining[bestItemIdx];
          const rect = freeRects[bestRectIdx];

          placed.push({
            key: `${sheetId}-${index}`,
            part: item.part,
            x: rect.x,
            y: rect.y,
            w: bestW,
            h: bestH,
            rotated: bestRotated,
            index: index++,
          });

          usedArea += bestW * bestH;
          remaining.splice(bestItemIdx, 1);
          placedAny = true;

          freeRects = splitFreeRectangles(freeRects, rect.x, rect.y, bestW, bestH, kerf);
        }
      }
    }

    if (placed.length === 0) break;

    const rawSheet = {
      id: sheetId,
      material: parts[0]?.material || "IS2062 E250A",
      thickness: parts[0]?.thickness || 6,
      sheetLength,
      sheetWidth,
      placed,
      usedArea,
      utilization: (usedArea / (sheetLength * sheetWidth)) * 100,
    };

    sheets.push(gravityCompactSheet(rawSheet, config));
  }

  return sheets;
}

const config = { sheetLength: 6000, sheetWidth: 1250, kerf: 3, trim: 0, rotation: true };
const sheets = solveBlockDimensionClustering(PARTS_6MM, 6000, 1250, config);
console.log(`- Result Sheets: ${sheets.length}, Collisions: ${checkCollisions(sheets)}`);
sheets.forEach(s => {
  const maxX = Math.max(...s.placed.map(p => p.x + p.w));
  console.log(`  ${s.id}: ${s.placed.length} parts, Util: ${s.utilization.toFixed(2)}%, maxX: ${maxX} mm (Remnant: ${6000 - maxX} mm)`);
  
  // Show grouping distribution
  const partsByItem = new Map();
  for (const p of s.placed) {
    const item = p.part.item;
    if (!partsByItem.has(item)) partsByItem.set(item, []);
    partsByItem.get(item).push(p);
  }
  for (const [item, list] of partsByItem) {
    const minX = Math.min(...list.map(p => p.x));
    const maxX = Math.max(...list.map(p => p.x + p.w));
    console.log(`    * ${item} (${list.length} pcs): X in [${minX}..${maxX} mm], W=${list[0].w}, H=${list[0].h}`);
  }
});
