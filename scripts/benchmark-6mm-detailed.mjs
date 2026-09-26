import { optimize } from "../src/lib/nesting.ts";

const PARTS_6MM = [
  { id:"P010", item:"CL-501", description:"Cleat plate", material:"IS2062 E250A", thickness:6, length:150, width:150, qty:96, invalid:null },
  { id:"P011", item:"CL-502", description:"Shear cleat", material:"IS2062 E250A", thickness:6, length:260, width:180, qty:64, invalid:null },
  { id:"P018", item:"WP-905", description:"Walkway plate", material:"IS2062 E250A", thickness:6, length:340, width:120, qty:72, invalid:null },
  { id:"P019", item:"WP-906", description:"Handrail base", material:"IS2062 E250A", thickness:6, length:120, width:120, qty:120, invalid:null },
];

function checkCollisions(sheets, kerf) {
  let collisions = 0;
  for (const s of sheets) {
    const placed = s.placed;
    for (let i = 0; i < placed.length; i++) {
      const a = placed[i];
      // Check sheet boundary
      if (a.x < 0 || a.y < 0 || a.x + a.w > s.sheetLength || a.y + a.h > s.sheetWidth) {
        collisions++;
      }
      for (let j = i + 1; j < placed.length; j++) {
        const b = placed[j];
        const overlapX = a.x < b.x + b.w && a.x + a.w > b.x;
        const overlapY = a.y < b.y + b.h && a.y + a.h > b.y;
        if (overlapX && overlapY) {
          collisions++;
        }
      }
    }
  }
  return collisions;
}

export function run6mmBenchmark(stockLength, stockWidth, label, trim = 0, kerf = 3) {
  const config = {
    sheetLength: stockLength,
    sheetWidth: stockWidth,
    kerf,
    trim,
    rotation: true,
    algorithm: "auto",
    preset: "balanced",
    groupByMaterial: false,
    plateTypes: [],
  };

  const t0 = performance.now();
  const res = optimize(PARTS_6MM, config);
  const runtimeMs = performance.now() - t0;

  const totalSheetArea = res.sheets.reduce((sum, s) => sum + s.sheetLength * s.sheetWidth, 0);
  const totalUsedArea = res.sheets.reduce((sum, s) => sum + s.usedArea, 0);
  const wasteArea = Math.max(0, totalSheetArea - totalUsedArea);
  const wastePercent = 100 - res.utilization;
  const collisionCount = checkCollisions(res.sheets, kerf);
  const totalPartsPlaced = res.sheets.reduce((sum, s) => sum + s.placed.length, 0);
  const expectedPieces = PARTS_6MM.reduce((sum, p) => sum + p.qty, 0);

  console.log(`\n======================================================================`);
  console.log(`BENCHMARK REPORT: ${label} (${stockLength} × ${stockWidth} mm)`);
  console.log(`======================================================================`);
  console.log(`- Number of sheets:          ${res.sheetCount} sheets`);
  console.log(`- Parts successfully placed: ${totalPartsPlaced} / ${expectedPieces} pieces`);
  console.log(`- Collision count:           ${collisionCount} (MUST BE 0)`);
  console.log(`- Total material utilization: ${res.utilization.toFixed(2)}%`);
  console.log(`- Waste area:                ${(wasteArea / 1e6).toFixed(4)} m² (${wasteArea.toLocaleString()} mm²)`);
  console.log(`- Waste percentage:          ${wastePercent.toFixed(2)}%`);
  console.log(`- Reusable remnant area:     ${((res.metrics?.reusableRemnantArea ?? 0) / 1e6).toFixed(4)} m²`);
  console.log(`- Total cut length:          ${(res.metrics?.totalCutLength ?? 0).toLocaleString()} mm`);
  console.log(`- Runtime:                   ${runtimeMs.toFixed(1)} ms`);
  console.log(`- Per-sheet Breakdown:`);
  res.sheets.forEach((s, idx) => {
    const sArea = s.sheetLength * s.sheetWidth;
    const sWaste = sArea - s.usedArea;
    console.log(`    Sheet ${s.id} (${s.sheetLength}×${s.sheetWidth}mm): ${s.placed.length} parts, Util: ${s.utilization.toFixed(2)}%, Waste: ${(sWaste/1e6).toFixed(3)}m² (${(100 - s.utilization).toFixed(1)}%)`);
  });
  console.log(`======================================================================\n`);

  return { res, runtimeMs, collisionCount, totalPartsPlaced };
}

// Run for 6000x1250, 6000x1500, and 2500x1250
run6mmBenchmark(6000, 1250, "Stock 6000 × 1250 mm (CHQ Standard)");
run6mmBenchmark(6000, 1500, "Stock 6000 × 1500 mm (Workshop Standard)");
run6mmBenchmark(2500, 1250, "Stock 2500 × 1250 mm (HR Sheet Standard)");
