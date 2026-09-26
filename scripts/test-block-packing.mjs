import {
  evaluateLayoutScore,
  DEFAULT_SCORING_WEIGHTS,
  gravityCompactSheet,
} from "../src/lib/nesting.ts";

const PARTS_6MM = [
  { id:"P010", item:"CL-501", description:"Cleat plate", material:"IS2062 E250A", thickness:6, length:150, width:150, qty:96, invalid:null },
  { id:"P011", item:"CL-502", description:"Shear cleat", material:"IS2062 E250A", thickness:6, length:260, width:180, qty:64, invalid:null },
  { id:"P018", item:"WP-905", description:"Walkway plate", material:"IS2062 E250A", thickness:6, length:340, width:120, qty:72, invalid:null },
  { id:"P019", item:"WP-906", description:"Handrail base", material:"IS2062 E250A", thickness:6, length:120, width:120, qty:120, invalid:null },
];

const USER_PROMPT_EXAMPLE = [
  { id:"UE-1", item:"PL-1", description:"Plate 1", material:"IS2062", thickness:6, length:500, width:100, qty:10, invalid:null },
  { id:"UE-2", item:"PL-2", description:"Plate 2", material:"IS2062", thickness:6, length:700, width:100, qty:5, invalid:null },
  { id:"UE-3", item:"PL-3", description:"Plate 3", material:"IS2062", thickness:6, length:500, width:200, qty:8, invalid:null },
  { id:"UE-4", item:"PL-4", description:"Plate 4", material:"IS2062", thickness:6, length:300, width:300, qty:4, invalid:null },
  { id:"UE-5", item:"PL-5", description:"Plate 5", material:"IS2062", thickness:6, length:100, width:50, qty:20, invalid:null },
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

/**
 * Enhanced Block & Dimension Family Packer:
 * 1. Groups identical parts (same L & W).
 * 2. Explores both Horizontal (H) and Vertical (V) orientation for each block.
 * 3. Keeps same width and length parts strictly together with zero in-between space.
 * 4. Fills cavities at block tops/ends with compatible dimension family parts.
 */
function packBlockClusterSheet(
  parts,
  sheetLength,
  sheetWidth,
  config,
  orientationPreference = "columns" // "columns" (along Y) or "shelves" (along X)
) {
  const trim = config.trim;
  const kerf = config.kerf;
  const allowRotation = config.rotation;
  const usableL = sheetLength - trim * 2;
  const usableW = sheetWidth - trim * 2;

  // 1. Group identical parts
  const groupMap = new Map();
  for (const p of parts) {
    if (p.invalid || p.qty <= 0) continue;
    let l = p.length;
    let w = p.width;
    if (allowRotation && w > l) [l, w] = [w, l];
    const key = `${p.thickness}|${p.material}|${l}x${w}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        id: `GRP-${groupMap.size + 1}`,
        part: p,
        length: l,
        width: w,
        qty: p.qty,
        totalArea: l * w * p.qty,
      });
    } else {
      groupMap.get(key).qty += p.qty;
      groupMap.get(key).totalArea += l * w * p.qty;
    }
  }

  let remainingGroups = [...groupMap.values()].map((g) => ({ ...g, remainingQty: g.qty }));
  const sheets = [];

  while (remainingGroups.some((g) => g.remainingQty > 0)) {
    const sheetId = `S${String(sheets.length + 1).padStart(2, "0")}`;
    const placed = [];
    let currentX = trim;
    let currentY = trim;
    let usedArea = 0;
    let index = 0;

    const freeRectangles = [];

    // Sort remaining groups by area descending
    remainingGroups.sort((a, b) => b.totalArea - a.totalArea || b.remainingQty - a.remainingQty);

    if (orientationPreference === "columns") {
      // Place vertical blocks of identical parts side by side along X
      for (const g of remainingGroups) {
        if (g.remainingQty <= 0) continue;

        // Evaluate both orientations (Horizontal: W=L, H=W vs Vertical: W=W, H=L)
        const orientations = [];
        orientations.push({ w: g.length, h: g.width, rotated: false });
        if (allowRotation && g.length !== g.width) {
          orientations.push({ w: g.width, h: g.length, rotated: true });
        }

        let bestOrient = orientations[0];
        let bestRows = 0;
        let bestScore = -1;

        for (const orient of orientations) {
          const rows = Math.floor((usableW + kerf) / (orient.h + kerf));
          if (rows <= 0) continue;
          const heightUsed = rows * orient.h + (rows - 1) * kerf;
          const fillRatio = heightUsed / usableW;

          // Prefer orientation that has higher vertical fill ratio (less wasted space above block)
          const score = fillRatio * 100;
          if (score > bestScore) {
            bestScore = score;
            bestOrient = orient;
            bestRows = rows;
          }
        }

        if (bestRows <= 0) continue;

        const spaceX = sheetLength - trim - currentX;
        const maxColsBySpace = Math.floor((spaceX + kerf) / (bestOrient.w + kerf));
        if (maxColsBySpace <= 0) continue;

        const neededCols = Math.ceil(g.remainingQty / bestRows);
        const colsToPlace = Math.min(maxColsBySpace, neededCols);
        if (colsToPlace <= 0) continue;

        const blockWidth = colsToPlace * bestOrient.w + (colsToPlace - 1) * kerf;
        const blockHeight = bestRows * bestOrient.h + (bestRows - 1) * kerf;

        // Place the dense grid of identical parts
        for (let c = 0; c < colsToPlace; c++) {
          const colX = currentX + c * (bestOrient.w + kerf);
          for (let r = 0; r < bestRows; r++) {
            if (g.remainingQty <= 0) break;
            const partY = trim + r * (bestOrient.h + kerf);

            placed.push({
              key: `${sheetId}-${index}`,
              part: g.part,
              x: colX,
              y: partY,
              w: bestOrient.w,
              h: bestOrient.h,
              rotated: bestOrient.rotated,
              index: index++,
            });
            usedArea += bestOrient.w * bestOrient.h;
            g.remainingQty--;
          }
        }

        // Register the empty cavity directly ABOVE this block for other matching parts
        const topRemainderH = sheetWidth - trim - (trim + blockHeight + kerf);
        if (topRemainderH > 30) {
          freeRectangles.push({
            x: currentX,
            y: trim + blockHeight + kerf,
            w: blockWidth,
            h: topRemainderH,
          });
        }

        currentX += blockWidth + kerf;
      }
    } else {
      // Place horizontal shelves of identical parts stacked along Y
      for (const g of remainingGroups) {
        if (g.remainingQty <= 0) continue;

        const orientations = [];
        orientations.push({ w: g.length, h: g.width, rotated: false });
        if (allowRotation && g.length !== g.width) {
          orientations.push({ w: g.width, h: g.length, rotated: true });
        }

        let bestOrient = orientations[0];
        let bestCols = 0;
        let bestScore = -1;

        for (const orient of orientations) {
          const cols = Math.floor((usableL + kerf) / (orient.w + kerf));
          if (cols <= 0) continue;
          const lengthUsed = cols * orient.w + (cols - 1) * kerf;
          const fillRatio = lengthUsed / usableL;

          const score = fillRatio * 100;
          if (score > bestScore) {
            bestScore = score;
            bestOrient = orient;
            bestCols = cols;
          }
        }

        if (bestCols <= 0) continue;

        const spaceY = sheetWidth - trim - currentY;
        const maxRowsBySpace = Math.floor((spaceY + kerf) / (bestOrient.h + kerf));
        if (maxRowsBySpace <= 0) continue;

        const neededRows = Math.ceil(g.remainingQty / bestCols);
        const rowsToPlace = Math.min(maxRowsBySpace, neededRows);
        if (rowsToPlace <= 0) continue;

        const shelfHeight = rowsToPlace * bestOrient.h + (rowsToPlace - 1) * kerf;
        const shelfWidth = bestCols * bestOrient.w + (bestCols - 1) * kerf;

        for (let r = 0; r < rowsToPlace; r++) {
          const rowY = currentY + r * (bestOrient.h + kerf);
          for (let c = 0; c < bestCols; c++) {
            if (g.remainingQty <= 0) break;
            const partX = trim + c * (bestOrient.w + kerf);

            placed.push({
              key: `${sheetId}-${index}`,
              part: g.part,
              x: partX,
              y: rowY,
              w: bestOrient.w,
              h: bestOrient.h,
              rotated: bestOrient.rotated,
              index: index++,
            });
            usedArea += bestOrient.w * bestOrient.h;
            g.remainingQty--;
          }
        }

        const rightRemainderW = sheetLength - trim - (trim + shelfWidth + kerf);
        if (rightRemainderW > 30) {
          freeRectangles.push({
            x: trim + shelfWidth + kerf,
            y: currentY,
            w: rightRemainderW,
            h: shelfHeight,
          });
        }

        currentY += shelfHeight + kerf;
      }
    }

    // Secondary Space Filling: fill top and edge cavities with remaining parts
    for (const rect of freeRectangles) {
      let placedAny = true;
      while (placedAny) {
        placedAny = false;
        for (const g of remainingGroups) {
          if (g.remainingQty <= 0) continue;

          const orientations = [{ w: g.length, h: g.width, rotated: false }];
          if (allowRotation && g.length !== g.width) {
            orientations.push({ w: g.width, h: g.length, rotated: true });
          }

          for (const orient of orientations) {
            if (orient.w <= rect.w && orient.h <= rect.h) {
              // How many parts fit in this free rectangle?
              const cols = Math.floor((rect.w + kerf) / (orient.w + kerf));
              const rows = Math.floor((rect.h + kerf) / (orient.h + kerf));

              for (let c = 0; c < cols && g.remainingQty > 0; c++) {
                const px = rect.x + c * (orient.w + kerf);
                for (let r = 0; r < rows && g.remainingQty > 0; r++) {
                  const py = rect.y + r * (orient.h + kerf);

                  placed.push({
                    key: `${sheetId}-${index}`,
                    part: g.part,
                    x: px,
                    y: py,
                    w: orient.w,
                    h: orient.h,
                    rotated: orient.rotated,
                    index: index++,
                  });
                  usedArea += orient.w * orient.h;
                  g.remainingQty--;
                  placedAny = true;
                }
              }
              break;
            }
          }
          if (placedAny) break;
        }
      }
    }

    if (placed.length === 0) break;

    const rawSheet = {
      id: sheetId,
      material: parts[0]?.material || "STEEL",
      thickness: parts[0]?.thickness || 6,
      sheetLength,
      sheetWidth,
      placed,
      usedArea,
      utilization: (usedArea / (sheetLength * sheetWidth)) * 100,
    };

    // Compact using 2D gravity to close any small residual kerf spacing
    sheets.push(gravityCompactSheet(rawSheet, config));
  }

  return sheets;
}

console.log("=== TESTING DUAL-ORIENTATION BLOCK & DIMENSION FAMILY PACKER ===");
const conf = { sheetLength: 6000, sheetWidth: 1250, kerf: 3, trim: 0, rotation: true };
const colRes = packBlockClusterSheet(PARTS_6MM, 6000, 1250, conf, "columns");
console.log(`- Column Blocks: Sheets = ${colRes.length}, Collisions = ${checkCollisions(colRes)}`);
colRes.forEach(s => {
  const maxX = Math.max(...s.placed.map(p => p.x + p.w));
  console.log(`  ${s.id}: ${s.placed.length} parts, Util: ${s.utilization.toFixed(2)}%, maxX: ${maxX} mm (Remnant: ${6000 - maxX} mm)`);
});

const shelfRes = packBlockClusterSheet(PARTS_6MM, 6000, 1250, conf, "shelves");
console.log(`\n- Shelf Blocks: Sheets = ${shelfRes.length}, Collisions = ${checkCollisions(shelfRes)}`);
shelfRes.forEach(s => {
  const maxX = Math.max(...s.placed.map(p => p.x + p.w));
  console.log(`  ${s.id}: ${s.placed.length} parts, Util: ${s.utilization.toFixed(2)}%, maxX: ${maxX} mm (Remnant: ${6000 - maxX} mm)`);
});
