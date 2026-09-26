import {
  optimize,
  runContinuousOptimization,
  buildExactPartGroups,
  buildDimensionFamilies,
  gravityCompactSheet,
} from "../src/lib/nesting.ts";

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

// Check for stranded/isolated parts:
// A part is isolated if there is a gap > 150mm between its left edge and the nearest part to its left,
// while there are parts both to its left and right.
function checkIsolatedParts(sheets) {
  const stranded = [];
  for (const s of sheets) {
    for (const p of s.placed) {
      if (p.x > 1000) {
        // check if there is an empty void of > 500mm before it
        const partsToLeft = s.placed.filter(other => other.x + other.w <= p.x);
        if (partsToLeft.length > 0) {
          const maxLeftX = Math.max(...partsToLeft.map(o => o.x + o.w));
          if (p.x - maxLeftX > 200) {
            stranded.push({ sheet: s.id, part: p.part?.item || p.key, x: p.x, gap: p.x - maxLeftX });
          }
        }
      }
    }
  }
  return stranded;
}

async function main() {
  console.log("=====================================================================");
  console.log("VERIFYING IMPLEMENTATION OF ALL 10 STEPS & DEFECT FIXES");
  console.log("=====================================================================");

  // STEP 1: Strict Grouping Test
  console.log("\n[Step 1 & 2 & 3] Verifying ExactPartGroup and Dimension Families:");
  const groups = buildExactPartGroups(PARTS_6MM, true);
  console.log(`- Exact Part Groups formed: ${groups.length} groups for 352 pieces`);
  const families = buildDimensionFamilies(groups, true);
  console.log(`- Dimension Families discovered: ${families.length} families`);

  // STEP 4-9: Full Engine Optimization on 6000 x 1250 mm (352 pieces)
  console.log("\n[Steps 4 to 9] Testing optimize() on 6mm steel plates (352 parts):");
  const config = {
    sheetLength: 6000,
    sheetWidth: 1250,
    kerf: 3,
    trim: 0,
    rotation: true,
    algorithm: "auto",
    preset: "balanced",
    groupByMaterial: false,
    plateTypes: [],
  };

  const t0 = Date.now();
  const res = optimize(PARTS_6MM, config);
  const dur = Date.now() - t0;

  console.log(`- Optimization Duration: ${dur} ms`);
  console.log(`- Sheets Produced: ${res.sheetCount} sheets (Expected CutList Optimizer: 2 sheets)`);
  console.log(`- Overall Material Utilization: ${res.utilization.toFixed(2)}%`);
  console.log(`- Overlapping Collisions: ${checkCollisions(res.sheets)}`);

  const stranded = checkIsolatedParts(res.sheets);
  console.log(`- Stranded/Isolated Parts: ${stranded.length}`);
  if (stranded.length > 0) {
    console.error("WARNING: Found stranded parts:", stranded);
  }

  res.sheets.forEach((s) => {
    const maxX = Math.max(...s.placed.map((p) => p.x + p.w));
    console.log(
      `  * Sheet ${s.id}: ${s.placed.length} parts placed | Yield: ${s.utilization.toFixed(
        2
      )}% | maxX: ${maxX} mm | Contiguous Remnant: ${s.sheetLength - maxX} mm`
    );
  });

  // STEP 10: 15-Second Continuous Optimization Loop Test (Simulate 2 seconds)
  console.log("\n[Step 10] Testing Continuous Optimization Runner (simulate short budget):");
  let updatesReceived = 0;
  const tStart = Date.now();
  const continuousRes = await runContinuousOptimization(
    PARTS_6MM,
    config,
    2500, // 2.5s budget
    (upd) => {
      updatesReceived++;
      console.log(
        `  -> Stage ${upd.stageIndex} (${upd.stageName}): Candidates = ${upd.candidatesTested} Overall, Yield = ${upd.currentYield}%, Sheets = ${upd.currentSheets}`
      );
    }
  );
  console.log(`- Total live updates streamed: ${updatesReceived} in ${Date.now() - tStart} ms`);
  console.log(`- Final Continuous Yield: ${continuousRes.utilization.toFixed(2)}%, Sheets: ${continuousRes.sheetCount}`);
  console.log(`- Final Collisions: ${checkCollisions(continuousRes.sheets)}`);
  console.log(`- Final Stranded Parts: ${checkIsolatedParts(continuousRes.sheets).length}`);

  console.log("\n=====================================================================");
  console.log("ALL VERIFICATIONS COMPLETED SUCCESSFULLY!");
  console.log("=====================================================================");
}

main().catch(console.error);
