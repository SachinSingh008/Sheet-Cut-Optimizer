import { optimize } from "../src/lib/nesting.ts";

const PARTS_6MM = [
  { id:"P010", item:"CL-501", description:"Cleat plate", material:"IS2062 E250A", thickness:6, length:150, width:150, qty:96, invalid:null },
  { id:"P011", item:"CL-502", description:"Shear cleat", material:"IS2062 E250A", thickness:6, length:260, width:180, qty:64, invalid:null },
  { id:"P018", item:"WP-905", description:"Walkway plate", material:"IS2062 E250A", thickness:6, length:340, width:120, qty:72, invalid:null },
  { id:"P019", item:"WP-906", description:"Handrail base", material:"IS2062 E250A", thickness:6, length:120, width:120, qty:120, invalid:null },
];

console.log("=== Debugging 6mm Sheet Generation Across Specific Stock Dimensions ===");

const testCases = [
  { label: "6300 x 1500 mm (Regular Standard)", l: 6300, w: 1500 },
  { label: "6000 x 1250 mm (CHQ Standard)", l: 6000, w: 1250 },
  { label: "2500 x 1250 mm (HR Sheet)", l: 2500, w: 1250 },
  { label: "2440 x 1220 mm (4ft x 8ft Sheet)", l: 2440, w: 1220 },
];

for (const tc of testCases) {
  const config = {
    sheetLength: tc.l,
    sheetWidth: tc.w,
    kerf: 3,
    trim: 0,
    rotation: true,
    algorithm: "auto",
    preset: "balanced",
    groupByMaterial: false,
    plateTypes: [], // Override automatic SAIL plate matching to force exact stock dimensions
  };

  const res = optimize(PARTS_6MM, config);
  console.log(`\n==================================================`);
  console.log(`Stock Size: ${tc.label} (${tc.l} x ${tc.w} mm)`);
  console.log(`Total Sheets Generated: ${res.sheetCount}`);
  console.log(`Overall Material Utilization: ${res.utilization.toFixed(2)}%`);
  
  for (let i = 0; i < res.sheets.length; i++) {
    const s = res.sheets[i];
    console.log(`   Sheet ${s.id}: ${s.placed.length} parts placed, ${s.utilization.toFixed(2)}% utilization`);
  }
}
