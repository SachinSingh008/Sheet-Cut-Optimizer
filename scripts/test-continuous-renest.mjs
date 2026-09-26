import { optimize, evaluateLayoutScore, DEFAULT_SCORING_WEIGHTS } from "../src/lib/nesting.ts";

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

function gravityCompactSheet(sheet, config) {
  const trim = config.trim;
  const kerf = config.kerf;
  const placed = sheet.placed.map((p) => ({ ...p }));
  const N = placed.length;
  if (N <= 1) {
    if (N === 1) {
      placed[0].x = trim;
      placed[0].y = trim;
    }
    return { ...sheet, placed };
  }

  let movedAny = true;
  let iterations = 0;

  while (movedAny && iterations < 30) {
    movedAny = false;
    iterations++;

    // Sort parts primarily by x ascending, then y ascending
    placed.sort((a, b) => a.x - b.x || a.y - b.y);

    for (let i = 0; i < N; i++) {
      const p = placed[i];

      // 1. Try sliding LEFT (decrease X)
      let minX = trim;
      for (let j = 0; j < N; j++) {
        if (i === j) continue;
        const other = placed[j];
        const yOverlap = p.y < other.y + other.h + kerf && p.y + p.h + kerf > other.y;
        if (yOverlap && other.x + other.w + kerf <= p.x) {
          const candidateX = other.x + other.w + kerf;
          if (candidateX > minX) {
            minX = candidateX;
          }
        }
      }

      if (minX < p.x) {
        let collision = false;
        for (let j = 0; j < N; j++) {
          if (i === j) continue;
          const other = placed[j];
          const xOverlap = minX < other.x + other.w + kerf && minX + p.w + kerf > other.x;
          const yOverlap = p.y < other.y + other.h + kerf && p.y + p.h + kerf > other.y;
          if (xOverlap && yOverlap) {
            collision = true;
            break;
          }
        }
        if (!collision) {
          p.x = minX;
          movedAny = true;
        }
      }

      // 2. Try sliding DOWN (decrease Y)
      let minY = trim;
      for (let j = 0; j < N; j++) {
        if (i === j) continue;
        const other = placed[j];
        const xOverlap = p.x < other.x + other.w + kerf && p.x + p.w + kerf > other.x;
        if (xOverlap && other.y + other.h + kerf <= p.y) {
          const candidateY = other.y + other.h + kerf;
          if (candidateY > minY) {
            minY = candidateY;
          }
        }
      }

      if (minY < p.y) {
        let collision = false;
        for (let j = 0; j < N; j++) {
          if (i === j) continue;
          const other = placed[j];
          const xOverlap = p.x < other.x + other.w + kerf && p.x + p.w + kerf > other.x;
          const yOverlap = minY < other.y + other.h + kerf && minY + p.h + kerf > other.y;
          if (xOverlap && yOverlap) {
            collision = true;
            break;
          }
        }
        if (!collision) {
          p.y = minY;
          movedAny = true;
        }
      }
    }
  }

  const usedArea = placed.reduce((sum, p) => sum + p.w * p.h, 0);
  const totalSheetArea = sheet.sheetLength * sheet.sheetWidth || 1;
  const utilization = (usedArea / totalSheetArea) * 100;

  return { ...sheet, placed, usedArea, utilization };
}

// Test running an iterative re-nesting loop for 3 seconds
console.log("=== Testing Continuous Re-nesting & Compaction Loop (3s budget) ===");
const config = { sheetLength: 6000, sheetWidth: 1250, kerf: 3, trim: 0, rotation: true, algorithm: 'auto', preset: 'balanced', groupByMaterial: false, plateTypes: [] };

const t0 = Date.now();
const res = optimize(PARTS_6MM, config);
console.log(`Initial solution: ${res.sheetCount} sheets, ${res.utilization.toFixed(2)}% yield in ${Date.now() - t0}ms`);

// Test applying gravity compaction to all sheets of the result
const compactedSheets = res.sheets.map(s => gravityCompactSheet(s, config));
console.log(`Collisions after compaction: ${checkCollisions(compactedSheets)}`);

compactedSheets.forEach(s => {
  const maxX = Math.max(...s.placed.map(p => p.x + p.w));
  console.log(`Sheet ${s.id}: ${s.placed.length} parts, Util: ${s.utilization.toFixed(2)}%, maxX: ${maxX} mm (Remnant: ${s.sheetLength - maxX} mm)`);
});
