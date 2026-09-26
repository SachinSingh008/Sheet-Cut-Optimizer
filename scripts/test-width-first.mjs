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

/**
 * Strict Width-First, Then Length Packer:
 * 1. For current X, build a column that fills the sheet WIDTH (along Y) completely first.
 * 2. Keep parts of the same width & length together in this column.
 * 3. If there is leftover width at top, immediately fill it with a compatible part rotated to fit.
 * 4. Once width is filled, advance X (increase length) by column width.
 * 5. Repeat until parts are placed.
 */
function packStrictWidthFirst(parts, sheetLength, sheetWidth, config) {
  const trim = config.trim;
  const kerf = config.kerf;
  const allowRotation = config.rotation;
  const usableL = sheetLength - trim * 2;
  const usableW = sheetWidth - trim * 2;

  const remaining = [];
  for (const p of parts) {
    if (p.invalid || p.qty <= 0) continue;
    for (let q = 0; q < p.qty; q++) {
      remaining.push({
        qId: remaining.length,
        part: p,
        length: p.length,
        width: p.width,
      });
    }
  }

  const sheets = [];

  while (remaining.length > 0) {
    const sheetId = `S${String(sheets.length + 1).padStart(2, '0')}`;
    const placed = [];
    let currentX = trim;
    let index = 0;
    let usedArea = 0;

    while (currentX < sheetLength - trim && remaining.length > 0) {
      const spaceRemainingX = sheetLength - trim - currentX;
      if (spaceRemainingX <= 0) break;

      // Group available items by candidate column widths
      const widthMap = new Map();
      for (const item of remaining) {
        const orientations = [];
        orientations.push({ w: item.length, h: item.width, rotated: false });
        if (allowRotation && item.length !== item.width) {
          orientations.push({ w: item.width, h: item.length, rotated: true });
        }

        for (const orient of orientations) {
          if (orient.w <= spaceRemainingX && orient.h <= usableW) {
            if (!widthMap.has(orient.w)) widthMap.set(orient.w, []);
            widthMap.get(orient.w).push({ item, w: orient.w, h: orient.h, rotated: orient.rotated });
          }
        }
      }

      if (widthMap.size === 0) break;

      // For each candidate width, find the best column combination that fills sheet WIDTH (Y)
      let bestWidth = 0;
      let bestCombination = [];
      let bestFillH = 0;
      let bestIdenticalCount = 0;

      for (const [w, candidates] of widthMap) {
        // Group candidates by exact part id to keep identical parts together
        const byPart = new Map();
        for (const c of candidates) {
          const pid = c.item.part.id;
          if (!byPart.has(pid)) byPart.set(pid, []);
          byPart.get(pid).push(c);
        }

        // Try filling width (Y) starting with the largest identical part group
        for (const [pid, primaryItems] of byPart) {
          const colItems = [];
          let currentH = 0;

          // Fill width with identical parts first
          for (const c of primaryItems) {
            const nextH = currentH + (colItems.length > 0 ? kerf : 0) + c.h;
            if (nextH <= usableW) {
              colItems.push(c);
              currentH = nextH;
            } else {
              break;
            }
          }

          // If there is leftover width at the top, fill it with compatible parts
          const topRemainderH = usableW - currentH - kerf;
          if (topRemainderH > 20) {
            // Find other unplaced items that fit in topRemainderH and width <= w
            for (const other of remaining) {
              if (colItems.some(ci => ci.item.qId === other.qId)) continue;
              const orientations = [{ w: other.length, h: other.width, rotated: false }];
              if (allowRotation && other.length !== other.width) {
                orientations.push({ w: other.width, h: other.length, rotated: true });
              }

              for (const o of orientations) {
                if (o.w <= w && o.h <= topRemainderH) {
                  colItems.push({ item: other, w: o.w, h: o.h, rotated: o.rotated });
                  currentH += kerf + o.h;
                  break;
                }
              }
              if (usableW - currentH < 20) break;
            }
          }

          const fillRatio = currentH / usableW;
          const identicalInCol = colItems.filter(ci => ci.item.part.id === pid).length;

          // Score: prioritize filling sheet width first, then keeping identical parts together
          const score = fillRatio * 1000 + identicalInCol * 50 + w;
          if (score > bestFillH) {
            bestFillH = score;
            bestWidth = w;
            bestCombination = colItems;
            bestIdenticalCount = identicalInCol;
          }
        }
      }

      if (bestWidth <= 0 || bestCombination.length === 0) break;

      // Place the column: fills WIDTH first along Y
      let colY = trim;
      for (const chosen of bestCombination) {
        placed.push({
          key: `${sheetId}-${index}`,
          part: chosen.item.part,
          x: currentX,
          y: colY,
          w: chosen.w,
          h: chosen.h,
          rotated: chosen.rotated,
          index: index++,
        });

        usedArea += chosen.w * chosen.h;
        colY += chosen.h + kerf;

        const remIdx = remaining.findIndex(it => it.qId === chosen.item.qId);
        if (remIdx !== -1) remaining.splice(remIdx, 1);
      }

      // THEN advance in length (X)
      currentX += bestWidth + kerf;
    }

    if (placed.length === 0) break;

    const rawSheet = {
      id: sheetId,
      material: parts[0]?.material || "IS2062",
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

console.log("=== Testing Strict Width-First, Then Increase Length ===");
const conf = { sheetLength: 6000, sheetWidth: 1250, kerf: 3, trim: 0, rotation: true };
const sheets = packStrictWidthFirst(PARTS_6MM, 6000, 1250, conf);
console.log(`- Result Sheets: ${sheets.length}, Collisions: ${checkCollisions(sheets)}`);
sheets.forEach(s => {
  const maxX = Math.max(...s.placed.map(p => p.x + p.w));
  console.log(`  ${s.id}: ${s.placed.length} parts, Util: ${s.utilization.toFixed(2)}%, maxX: ${maxX} mm (Remnant: ${6000 - maxX} mm)`);
  
  const partsByItem = new Map();
  for (const p of s.placed) {
    const item = p.part.item;
    if (!partsByItem.has(item)) partsByItem.set(item, []);
    partsByItem.get(item).push(p);
  }
  for (const [item, list] of partsByItem) {
    const minX = Math.min(...list.map(p => p.x));
    const maxX = Math.max(...list.map(p => p.x + p.w));
    console.log(`    * ${item} (${list.length} pcs): X in [${minX}..${maxX} mm]`);
  }
});
